import { ByteReader } from './byte-reader';
import type { ChunkHeader, ConstantPools, Metadata } from './jfr-types';
import { decodeByClassId } from './value-decoder';

/**
 * Walks the backward-linked checkpoint (constant pool) event chain starting at
 * the chunk header's `constantPoolOffset`, decoding every pool entry along the
 * way. A single chunk can contain several checkpoint events (e.g. one flushed
 * every second during a long recording); their pools are merged by class id.
 */
export function parseConstantPools(reader: ByteReader, header: ChunkHeader, metadata: Metadata): ConstantPools {
  const pools: ConstantPools = new Map();
  const compressed = header.compressed;
  const visitedOffsets = new Set<number>();

  let offset = 0;
  let delta = header.constantPoolOffset;

  while (delta !== 0) {
    offset += delta;
    if (visitedOffsets.has(offset)) {
      break; // malformed chain guard
    }
    visitedOffsets.add(offset);

    reader.seek(offset);
    reader.readInt(compressed); // size (unused; each pool entry is self-delimiting via its declared fields)
    const eventType = reader.readLong(compressed);
    if (eventType !== 1n) {
      throw new Error(`JFR parse error: expected checkpoint event (type 1) at offset ${offset}, got type ${eventType}`);
    }
    reader.readLong(compressed); // startTime (unused)
    reader.readLong(compressed); // duration (unused)
    const nextDelta = Number(reader.readLong(compressed));
    reader.readByte(); // flushType (i8, always raw; unused)
    const poolCount = reader.readInt(compressed);

    for (let p = 0; p < poolCount; p++) {
      const classId = Number(reader.readLong(compressed));
      const constantCount = reader.readInt(compressed);
      let pool = pools.get(classId);
      if (!pool) {
        pool = new Map();
        pools.set(classId, pool);
      }
      for (let c = 0; c < constantCount; c++) {
        const constantIndex = Number(reader.readLong(compressed));
        const value = decodeByClassId(reader, compressed, metadata, classId);
        pool.set(constantIndex, value);
      }
    }

    delta = nextDelta;
  }

  return pools;
}
