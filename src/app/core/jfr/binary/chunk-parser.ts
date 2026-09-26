import { ByteReader } from './byte-reader';
import { parseConstantPools } from './constant-pool';
import { CHUNK_HEADER_SIZE, type ChunkHeader, type DecodedEvent, type ParsedChunk } from './jfr-types';
import { parseMetadata } from './metadata-parser';
import { decodeEventBody } from './value-decoder';

const MAGIC = [0x46, 0x4c, 0x52, 0x00]; // "FLR\0"

function parseChunkHeader(reader: ByteReader, fileOffset: number): ChunkHeader {
  for (const expected of MAGIC) {
    const b = reader.readU8();
    if (b !== expected) {
      throw new Error(`JFR parse error: bad chunk magic at file offset ${fileOffset}`);
    }
  }
  const versionMajor = reader.readRawI16();
  const versionMinor = reader.readRawI16();
  const chunkSize = Number(reader.readRawI64());
  const constantPoolOffset = Number(reader.readRawI64());
  const metadataOffset = Number(reader.readRawI64());
  const startTimeNanos = reader.readRawI64();
  const durationNanos = reader.readRawI64();
  const startTicks = reader.readRawI64();
  const ticksPerSecond = reader.readRawI64();
  const features = reader.readRawI32();

  return {
    fileOffset,
    versionMajor,
    versionMinor,
    chunkSize,
    constantPoolOffset,
    metadataOffset,
    startTimeNanos,
    durationNanos,
    startTicks,
    ticksPerSecond,
    compressed: (features & 0x1) !== 0,
  };
}

/** Parses a single chunk starting at `fileOffset` within `buffer`. Returns the chunk plus its total byte size, so the caller can advance to the next chunk. */
export function parseChunk(buffer: ArrayBuffer, fileOffset: number): { chunk: ParsedChunk; chunkSize: number } {
  const reader = new ByteReader(buffer, fileOffset, buffer.byteLength - fileOffset);
  const header = parseChunkHeader(reader, fileOffset);
  const metadata = parseMetadata(reader, header.metadataOffset, header.compressed);
  const pools = parseConstantPools(reader, header, metadata);

  const events: DecodedEvent[] = [];
  reader.seek(CHUNK_HEADER_SIZE);
  while (reader.pos < header.chunkSize) {
    const recordStart = reader.pos;
    const size = reader.readInt(header.compressed);
    if (size <= 0) {
      break; // malformed trailing bytes; stop scanning this chunk defensively
    }
    const typeId = Number(reader.readLong(header.compressed));
    if (typeId !== 0 && typeId !== 1) {
      const td = metadata.types.get(typeId);
      if (td) {
        const fields = decodeEventBody(reader, header.compressed, metadata, typeId);
        events.push({ typeId, typeName: td.name, offset: recordStart, fields });
      }
    }
    // Always resync on the record's declared size, regardless of what the
    // (possibly partial) decode above actually consumed.
    reader.seek(recordStart + size);
  }

  return { chunk: { header, metadata, pools, events }, chunkSize: header.chunkSize };
}
