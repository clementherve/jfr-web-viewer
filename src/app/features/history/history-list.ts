import { Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RecordingStateService } from '../../core/jfr/recording-state.service';
import { RecordingStoreService } from '../../core/storage/recording-store.service';
import type { StoredRecordingSummary } from '../../core/storage/recording-store.models';
import { formatBytes, formatDuration, relativeTime } from '../../shared/formatters';

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    @if (summaries().length === 0) {
      <p class="empty">No previous recordings yet&mdash;drop a .jfr file above to get started.</p>
    } @else {
      <ul class="history-list">
        @for (item of summaries(); track item.id) {
          <li class="history-row" (click)="open(item.id)">
            <mat-icon class="row-icon">insert_drive_file</mat-icon>
            <div class="row-main">
              <div class="row-title">{{ item.fileName }}</div>
              <div class="row-subtitle">
                {{ formatDuration(item.durationMs) }} &middot; {{ formatBytes(item.fileSizeBytes) }}
                @if (item.jvmVersion) {
                  &middot; {{ item.jvmVersion }}
                }
              </div>
            </div>
            <div class="row-time" [matTooltip]="absoluteTime(item.uploadedAtMs)">{{ relativeTime(item.uploadedAtMs) }}</div>
            <button mat-icon-button matTooltip="Remove from history" (click)="remove($event, item.id)">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .empty {
        color: var(--mat-sys-on-surface-variant);
        text-align: center;
        padding: 24px 0;
      }
      .history-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .history-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
      }
      .history-row:hover {
        background-color: var(--mat-sys-surface-container-high);
      }
      .row-icon {
        color: var(--mat-sys-on-surface-variant);
      }
      .row-main {
        flex: 1;
        min-width: 0;
      }
      .row-title {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .row-subtitle {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .row-time {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
        white-space: nowrap;
      }
    `,
  ],
})
export class HistoryListComponent {
  private readonly stateService = inject(RecordingStateService);
  private readonly store = inject(RecordingStoreService);

  protected readonly summaries = signal<StoredRecordingSummary[]>([]);

  constructor() {
    effect(() => {
      this.stateService.historyVersion();
      this.reload();
    });
  }

  private reload(): void {
    this.store.listSummaries().then((summaries) => this.summaries.set(summaries));
  }

  protected open(id: string): void {
    void this.stateService.loadFromHistory(id);
  }

  protected remove(event: Event, id: string): void {
    event.stopPropagation();
    void this.stateService.deleteFromHistory(id);
  }

  protected relativeTime = relativeTime;
  protected formatDuration = formatDuration;
  protected formatBytes = formatBytes;

  protected absoluteTime(ms: number): string {
    return new Date(ms).toLocaleString();
  }
}
