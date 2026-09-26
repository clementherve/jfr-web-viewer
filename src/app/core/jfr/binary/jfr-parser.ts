import { parseChunk } from './chunk-parser';
import type { RawParsedFile } from './jfr-types';

/**
 * Parses a full .jfr file into its raw, per-chunk decoded form (still containing
 * unresolved ConstantRef nodes). A JFR file is a concatenation of independent
 * chunks; each is fully self-contained (own metadata + constant pools).
 */
export function parseJfrFile(buffer: ArrayBuffer, onChunkParsed?: (chunkIndex: number, fileOffset: number) => void): RawParsedFile {
  const chunks: RawParsedFile['chunks'] = [];
  let fileOffset = 0;
  let chunkIndex = 0;

  while (fileOffset < buffer.byteLength) {
    const { chunk, chunkSize } = parseChunk(buffer, fileOffset);
    chunks.push(chunk);
    onChunkParsed?.(chunkIndex, fileOffset);
    fileOffset += chunkSize;
    chunkIndex++;
  }

  return { chunks };
}
