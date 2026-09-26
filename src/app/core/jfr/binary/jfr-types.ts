export interface ChunkHeader {
  /** Absolute byte offset of this chunk's magic within the file. */
  fileOffset: number;
  versionMajor: number;
  versionMinor: number;
  /** Total size of this chunk (including this 68-byte header), in bytes. */
  chunkSize: number;
  /** Chunk-relative offset to the start of the constant-pool checkpoint chain. */
  constantPoolOffset: number;
  /** Chunk-relative offset of the Metadata event. */
  metadataOffset: number;
  startTimeNanos: bigint;
  durationNanos: bigint;
  startTicks: bigint;
  ticksPerSecond: bigint;
  /** true if int16/32/64/char fields in this chunk are compressed (varint)-encoded. */
  compressed: boolean;
}

export const CHUNK_HEADER_SIZE = 68;

export interface AnnotationDescriptor {
  /** Fully-qualified annotation class name, e.g. "jdk.jfr.Timestamp". */
  typeName: string;
  /** Raw attribute values on the annotation element (e.g. "TICKS", or repeated value-0/value-1 for @Category). */
  values: Record<string, string>;
}

export interface FieldDescriptor {
  name: string;
  /** class_id of this field's declared type. */
  classId: number;
  /** Resolved type name, filled in once all classes are known. */
  typeName: string;
  /** True if the on-the-wire value is a varint index into `classId`'s constant pool. */
  constantPool: boolean;
  /** True if this field is an array of the above type. */
  array: boolean;
  annotations: AnnotationDescriptor[];
}

export interface TypeDescriptor {
  id: number;
  name: string;
  superType?: string;
  simpleType: boolean;
  fields: FieldDescriptor[];
  annotations: AnnotationDescriptor[];
}

export interface Metadata {
  types: Map<number, TypeDescriptor>;
  typeIdByName: Map<string, number>;
}

/** Marker for a not-yet-resolved constant pool reference produced by the generic decoder. */
export class ConstantRef {
  constructor(
    public readonly classId: number,
    public readonly index: number,
  ) {}
}

/** A fully generic decoded value: a primitive, a ConstantRef, an array, or a struct (plain object keyed by field name). */
export type DecodedValue = string | number | bigint | boolean | ConstantRef | DecodedValue[] | { [field: string]: DecodedValue } | null;

export interface DecodedEvent {
  typeId: number;
  typeName: string;
  /** Byte offset (chunk-relative) where this event record started; stable identity for dedup/debugging. */
  offset: number;
  fields: { [field: string]: DecodedValue };
}

/** Pools[classId].get(constantIndex) -> decoded value (still possibly containing nested ConstantRefs). */
export type ConstantPools = Map<number, Map<number, DecodedValue>>;

export interface ParsedChunk {
  header: ChunkHeader;
  metadata: Metadata;
  pools: ConstantPools;
  events: DecodedEvent[];
}

export interface RawParsedFile {
  chunks: ParsedChunk[];
}
