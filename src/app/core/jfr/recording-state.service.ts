import { Injectable, inject, signal } from '@angular/core';
import { RecordingStoreService } from '../storage/recording-store.service';
import { JfrParserService, type ParseProgress } from './jfr-parser.service';
import type { ParsedRecording } from './models';

@Injectable({ providedIn: 'root' })
export class RecordingStateService {
  private readonly parser = inject(JfrParserService);
  private readonly store = inject(RecordingStoreService);

  readonly recording = signal<ParsedRecording | null>(null);
  readonly loading = signal(false);
  readonly progress = signal<ParseProgress | null>(null);
  readonly error = signal<string | null>(null);
  /** Bumped after every save/delete so the history list knows to refetch. */
  readonly historyVersion = signal(0);

  async loadFile(file: File): Promise<void> {
    await this.runParse(file, async (recording) => {
      await this.store.saveRecording(file, recording);
    });
  }

  async loadFromHistory(id: string): Promise<void> {
    const file = await this.store.getFile(id);
    if (!file) {
      this.error.set('This recording is no longer available (it may have been evicted from local storage).');
      return;
    }
    await this.runParse(file, async () => {
      await this.store.touch(id);
    });
  }

  async deleteFromHistory(id: string): Promise<void> {
    await this.store.deleteRecording(id);
    this.historyVersion.update((v) => v + 1);
  }

  clear(): void {
    this.recording.set(null);
    this.error.set(null);
    this.parser.dispose();
  }

  private async runParse(file: File, afterParse: (recording: ParsedRecording) => Promise<void>): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.progress.set(null);
    try {
      const recording = await this.parser.parse(file, (p) => this.progress.set(p));
      this.recording.set(recording);
      await afterParse(recording);
      this.historyVersion.update((v) => v + 1);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
      this.progress.set(null);
    }
  }
}
