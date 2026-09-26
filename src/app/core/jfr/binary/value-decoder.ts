import { ByteReader } from './byte-reader';
import { ConstantRef, type DecodedValue, type FieldDescriptor, type Metadata, type TypeDescriptor } from './jfr-types';

const PRIMITIVE_NAMES = new Set(['int', 'long', 'float', 'double', 'char', 'boolean', 'short', 'byte', 'java.lang.String']);

function decodePrimitive(reader: ByteReader, compressed: boolean, metadata: Metadata, typeName: string): DecodedValue {
  switch (typeName) {
    case 'int':
      return reader.readInt(compressed);
    case 'long':
      return reader.readLong(compressed);
    case 'float':
      return reader.readFloat();
    case 'double':
      return reader.readDouble();
    case 'char':
      return reader.readChar(compressed);
    case 'boolean':
      return reader.readBoolean(compressed);
    case 'short':
      return reader.readShort(compressed);
    case 'byte':
      return reader.readByte();
    case 'java.lang.String': {
      const s = reader.readEncodedString(compressed);
      if (typeof s === 'string') return s;
      const stringClassId = metadata.typeIdByName.get('java.lang.String') ?? -1;
      return new ConstantRef(stringClassId, s.poolRef);
    }
    default:
      throw new Error(`JFR parse error: unrecognized primitive type name "${typeName}"`);
  }
}

function decodeFieldValue(reader: ByteReader, compressed: boolean, metadata: Metadata, field: FieldDescriptor): DecodedValue {
  if (field.constantPool) {
    const idx = Number(reader.readLong(compressed));
    return new ConstantRef(field.classId, idx);
  }
  return decodeByClassId(reader, compressed, metadata, field.classId);
}

function decodeStruct(reader: ByteReader, compressed: boolean, metadata: Metadata, td: TypeDescriptor): DecodedValue {
  const obj: { [k: string]: DecodedValue } = {};
  for (const field of td.fields) {
    if (field.array) {
      const count = reader.readInt(compressed);
      const arr: DecodedValue[] = new Array(count);
      for (let i = 0; i < count; i++) arr[i] = decodeFieldValue(reader, compressed, metadata, field);
      obj[field.name] = arr;
    } else {
      obj[field.name] = decodeFieldValue(reader, compressed, metadata, field);
    }
  }
  return obj;
}

export function decodeByClassId(reader: ByteReader, compressed: boolean, metadata: Metadata, classId: number): DecodedValue {
  const td = metadata.types.get(classId);
  if (!td) {
    throw new Error(`JFR parse error: unknown class id ${classId} referenced at offset ${reader.pos}`);
  }
  if (PRIMITIVE_NAMES.has(td.name)) {
    return decodePrimitive(reader, compressed, metadata, td.name);
  }
  return decodeStruct(reader, compressed, metadata, td);
}

/** Decodes a full event/constant-pool-entry body for a top-level class id (always a struct at this level). */
export function decodeEventBody(reader: ByteReader, compressed: boolean, metadata: Metadata, classId: number): { [k: string]: DecodedValue } {
  const value = decodeByClassId(reader, compressed, metadata, classId);
  return value as { [k: string]: DecodedValue };
}
