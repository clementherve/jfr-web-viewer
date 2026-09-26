import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ParsedRecording } from '../jfr/models';
import type { StoredRecordingSummary } from './recording-store.models';

const DB_NAME = 'jfr-viewer';
const DB_VERSION = 1;
const MAX_HISTORY_ENTRIES = 20;

interface JfrViewerDb extends DBSchema {
  files: {
    key: string;
    value: { id: string; blob: Blob };
  };
  summaries: {
    key: string;
    value: StoredRecordingSummary;
    indexes: { 'by-uploadedAt': number };
  };
}

@Injectable({ providedIn: 'root' })
export class RecordingStoreService {
  private dbPromise: Promise<IDBPDatabase<JfrViewerDb>> | null = null;

  private db(): Promise<IDBPDatabase<JfrViewerDb>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<JfrViewerDb>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          db.createObjectStore('files', { keyPath: 'id' });
          const summaries = db.createObjectStore('summaries', { keyPath: 'id' });
          summaries.createIndex('by-uploadedAt', 'uploadedAtMs');
        },
      });
      navigator.storage?.persist?.().catch(() => undefined);
    }
    return this.dbPromise;
  }

  async saveRecording(file: File, recording: ParsedRecording): Promise<string> {
    const id = crypto.randomUUID();
    const summary: StoredRecordingSummary = {
      id,
      fileName: recording.fileName,
      fileSizeBytes: recording.fileSizeBytes,
      uploadedAtMs: Date.now(),
      durationMs: recording.metadata.durationMs,
      startTimeMs: recording.metadata.startTimeMs,
      jvmVersion: recording.metadata.jvmVersion,
      eventCount: recording.eventTypeSummary.reduce((sum, e) => sum + e.count, 0),
    };

    const db = await this.db();
    const tx = db.transaction(['files', 'summaries'], 'readwrite');
    await Promise.all([tx.objectStore('files').put({ id, blob: file }), tx.objectStore('summaries').put(summary), tx.done]);

    await this.evictOldest();
    return id;
  }

  async listSummaries(): Promise<StoredRecordingSummary[]> {
    const db = await this.db();
    const all = await db.getAllFromIndex('summaries', 'by-uploadedAt');
    return all.sort((a, b) => b.uploadedAtMs - a.uploadedAtMs);
  }

  async getFile(id: string): Promise<File | undefined> {
    const db = await this.db();
    const entry = await db.get('files', id);
    if (!entry) return undefined;
    const summary = await db.get('summaries', id);
    return new File([entry.blob], summary?.fileName ?? 'recording.jfr');
  }

  /** Bumps a history entry's timestamp to "just now" without re-storing its (already-present) file blob. */
  async touch(id: string): Promise<void> {
    const db = await this.db();
    const summary = await db.get('summaries', id);
    if (!summary) return;
    await db.put('summaries', { ...summary, uploadedAtMs: Date.now() });
  }

  async deleteRecording(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['files', 'summaries'], 'readwrite');
    await Promise.all([tx.objectStore('files').delete(id), tx.objectStore('summaries').delete(id), tx.done]);
  }

  private async evictOldest(): Promise<void> {
    const summaries = await this.listSummaries();
    const excess = summaries.slice(MAX_HISTORY_ENTRIES);
    for (const s of excess) {
      await this.deleteRecording(s.id);
    }
  }
}
