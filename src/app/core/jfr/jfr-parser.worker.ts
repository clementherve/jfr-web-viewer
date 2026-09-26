/// <reference lib="webworker" />
import { createResolver } from './binary/resolver';
import { ticksToEpochMs } from './binary/time';
import type { DecodedValue, RawParsedFile } from './binary/jfr-types';
import { parseJfrFile } from './binary/jfr-parser';
import { extractRecording } from './event-extractors';
import type { RawEventRow } from './models';

/** Kept alive after the initial parse so the generic event browser can page through any event type on demand, without re-parsing or eagerly resolving every event up front. */
let lastRawFile: RawParsedFile | null = null;

export interface ParseRequest {
  type: 'parse';
  buffer: ArrayBuffer;
  fileName: string;
  fileSizeBytes: number;
}

export interface BrowseEventsRequest {
  type: 'browseEvents';
  requestId: number;
  eventTypeName: string;
  offset: number;
  limit: number;
}

export type WorkerRequest = ParseRequest | BrowseEventsRequest;

function sanitize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitize(v);
    return out;
  }
  return value;
}

addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'parse') {
      postMessage({ type: 'progress', stage: 'Parsing binary format…' });
      const rawFile = parseJfrFile(msg.buffer, (chunkIndex, fileOffset) => {
        const pct = msg.buffer.byteLength > 0 ? Math.round((fileOffset / msg.buffer.byteLength) * 100) : 100;
        postMessage({ type: 'progress', stage: `Parsing chunk ${chunkIndex + 1}…`, percent: pct });
      });
      lastRawFile = rawFile;

      postMessage({ type: 'progress', stage: 'Extracting metrics…', percent: 90 });
      const recording = extractRecording(rawFile, msg.fileName, msg.fileSizeBytes);

      postMessage({ type: 'result', recording });
    } else if (msg.type === 'browseEvents') {
      const rows = browseEvents(msg.eventTypeName, msg.offset, msg.limit);
      postMessage({ type: 'browseEvents', requestId: msg.requestId, ...rows });
    }
  } catch (err) {
    postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
});

function browseEvents(eventTypeName: string, offset: number, limit: number): { rows: RawEventRow[]; total: number } {
  if (!lastRawFile) return { rows: [], total: 0 };

  const rows: RawEventRow[] = [];
  let total = 0;
  let skipped = 0;

  for (const chunk of lastRawFile.chunks) {
    const matching = chunk.events.filter((e) => e.typeName === eventTypeName);
    total += matching.length;
    if (rows.length >= limit) continue;

    const resolve = createResolver(chunk.pools);
    for (const ev of matching) {
      if (skipped < offset) {
        skipped++;
        continue;
      }
      if (rows.length >= limit) break;
      const resolved = resolve(ev.fields as unknown as DecodedValue);
      const startTicks = ev.fields['startTime'] as bigint | undefined;
      rows.push({
        timeMs: startTicks !== undefined ? ticksToEpochMs(startTicks, chunk.header) : null,
        offset: ev.offset,
        fields: sanitize(resolved) as Record<string, unknown>,
      });
    }
  }

  return { rows, total };
}
