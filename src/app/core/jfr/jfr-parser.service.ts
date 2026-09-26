import { Injectable } from '@angular/core';
import type { ParsedRecording, RawEventRow } from './models';

export interface ParseProgress {
  stage: string;
  percent?: number;
}

@Injectable({ providedIn: 'root' })
export class JfrParserService {
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private readonly pendingBrowseRequests = new Map<number, (result: { rows: RawEventRow[]; total: number }) => void>();

  /** Parses a .jfr file off the main thread. The same worker instance stays alive afterwards so `browseEvents` can page through raw events without re-parsing. */
  parse(file: File, onProgress?: (progress: ParseProgress) => void): Promise<ParsedRecording> {
    this.worker?.terminate();
    const worker = new Worker(new URL('./jfr-parser.worker', import.meta.url), { type: 'module' });
    this.worker = worker;

    return new Promise<ParsedRecording>((resolve, reject) => {
      worker.addEventListener('message', (event: MessageEvent) => {
        const msg = event.data;
        if (msg.type === 'progress') {
          onProgress?.({ stage: msg.stage, percent: msg.percent });
        } else if (msg.type === 'result') {
          resolve(msg.recording as ParsedRecording);
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
        } else if (msg.type === 'browseEvents') {
          const handler = this.pendingBrowseRequests.get(msg.requestId);
          if (handler) {
            this.pendingBrowseRequests.delete(msg.requestId);
            handler({ rows: msg.rows, total: msg.total });
          }
        }
      });
      worker.addEventListener('error', (event: ErrorEvent) => reject(new Error(event.message)));

      file.arrayBuffer().then((buffer) => {
        worker.postMessage({ type: 'parse', buffer, fileName: file.name, fileSizeBytes: file.size }, [buffer]);
      });
    });
  }

  /** Pages through fully-resolved rows of a single event type, from the worker's still-alive in-memory parse state. */
  browseEvents(eventTypeName: string, offset: number, limit: number): Promise<{ rows: RawEventRow[]; total: number }> {
    if (!this.worker) return Promise.resolve({ rows: [], total: 0 });
    const requestId = this.nextRequestId++;
    return new Promise((resolve) => {
      this.pendingBrowseRequests.set(requestId, resolve);
      this.worker!.postMessage({ type: 'browseEvents', requestId, eventTypeName, offset, limit });
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
