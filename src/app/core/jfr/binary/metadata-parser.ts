import { ByteReader } from './byte-reader';
import type { AnnotationDescriptor, FieldDescriptor, Metadata, TypeDescriptor } from './jfr-types';

interface RawElement {
  tag: string;
  attributes: Record<string, string>;
  children: RawElement[];
}

function readStringTable(reader: ByteReader, compressed: boolean): string[] {
  const count = reader.readInt(compressed);
  const strings: string[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const s = reader.readEncodedString(compressed);
    strings[i] = typeof s === 'string' ? s : '';
  }
  return strings;
}

function parseElementBody(reader: ByteReader, compressed: boolean, strings: string[]): Omit<RawElement, 'tag'> {
  const attrCount = reader.readInt(compressed);
  const attributes: Record<string, string> = {};
  for (let i = 0; i < attrCount; i++) {
    const keyIdx = reader.readInt(compressed);
    const valIdx = reader.readInt(compressed);
    attributes[strings[keyIdx]] = strings[valIdx];
  }
  const childCount = reader.readInt(compressed);
  const children: RawElement[] = new Array(childCount);
  for (let i = 0; i < childCount; i++) {
    const nameIdx = reader.readInt(compressed);
    const tag = strings[nameIdx];
    const body = parseElementBody(reader, compressed, strings);
    children[i] = { tag, attributes: body.attributes, children: body.children };
  }
  return { attributes, children };
}

/**
 * Parses the Metadata event (type id 0) located at `metadataOffset` (chunk-relative).
 * Builds the class-id -> TypeDescriptor map that drives all later generic decoding.
 */
export function parseMetadata(reader: ByteReader, metadataOffset: number, compressed: boolean): Metadata {
  reader.seek(metadataOffset);
  reader.readInt(compressed); // size (unused; we navigate by absolute offsets)
  const eventType = reader.readLong(compressed);
  if (eventType !== 0n) {
    throw new Error(`JFR parse error: expected Metadata event (type 0) at offset ${metadataOffset}, got type ${eventType}`);
  }
  reader.readLong(compressed); // startTime
  reader.readLong(compressed); // duration
  reader.readLong(compressed); // metadataId

  const strings = readStringTable(reader, compressed);

  reader.readInt(compressed); // root element name index (discarded; always "root")
  const rootBody = parseElementBody(reader, compressed, strings);
  const metadataElem = rootBody.children.find((c) => c.tag === 'metadata');
  const classElems = metadataElem ? metadataElem.children.filter((c) => c.tag === 'class') : [];

  // Pass 1: class id -> name, needed to resolve field type names and annotation semantics.
  const nameById = new Map<number, string>();
  for (const classElem of classElems) {
    const id = Number(classElem.attributes['id']);
    nameById.set(id, classElem.attributes['name'] ?? '');
  }

  const types = new Map<number, TypeDescriptor>();
  const typeIdByName = new Map<string, number>();

  for (const classElem of classElems) {
    const id = Number(classElem.attributes['id']);
    const name = classElem.attributes['name'] ?? '';
    const fields: FieldDescriptor[] = [];
    const annotations: AnnotationDescriptor[] = [];

    for (const child of classElem.children) {
      if (child.tag === 'field') {
        const fieldClassId = Number(child.attributes['class']);
        const dimension = child.attributes['dimension'] !== undefined ? Number(child.attributes['dimension']) : 0;
        fields.push({
          name: child.attributes['name'] ?? '',
          classId: fieldClassId,
          typeName: nameById.get(fieldClassId) ?? '',
          constantPool: child.attributes['constantPool'] === 'true',
          array: dimension > 0,
          annotations: child.children.filter((c) => c.tag === 'annotation').map((a) => toAnnotation(a, nameById)),
        });
      } else if (child.tag === 'annotation') {
        annotations.push(toAnnotation(child, nameById));
      }
      // 'setting' elements carry no decode-relevant information; ignored.
    }

    const descriptor: TypeDescriptor = {
      id,
      name,
      superType: classElem.attributes['superType'],
      simpleType: classElem.attributes['simpleType'] === 'true',
      fields,
      annotations,
    };
    types.set(id, descriptor);
    typeIdByName.set(name, id);
  }

  return { types, typeIdByName };
}

function toAnnotation(elem: RawElement, nameById: Map<number, string>): AnnotationDescriptor {
  const classId = Number(elem.attributes['class']);
  const values = { ...elem.attributes };
  delete values['class'];
  return { typeName: nameById.get(classId) ?? `#${classId}`, values };
}
