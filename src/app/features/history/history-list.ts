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
      <p class="empty">Recordings you open are kept here, in this browser, so you can come back to them later.</p>
    } @else {
      <ul class="history-list">
        @for (item of summaries(); track item.id) {
          <li class="history-row">
            <button type="button" class="row-open" (click)="open(item.id)">
              <span class="row-title">{{ item.fileName }}</span>
              <span class="row-meta">
                <span class="num">{{ formatDuration(item.durationMs) }}</span>
                <span class="num">{{ formatBytes(item.fileSizeBytes) }}</span>
                @if (item.jvmVersion) {
                  <span class="jvm">{{ item.jvmVersion }}</span>
                }
              </span>
              <span class="row-time" [matTooltip]="absoluteTime(item.uploadedAtMs)">{{ relativeTime(item.uploadedAtMs) }}</span>
            </button>
            <button mat-icon-button class="row-delete" matTooltip="Remove from this list" [attr.aria-label]="'Remove ' + item.fileName" (click)="remove(item.id)">
              <mat-icon>delete</mat-icon>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .empty {
        color: var(--muted);
        margin: 0;
        padding: 20px;
        border: 1px dashed var(--rule);
        border-radius: var(--radius-m);
      }
      .history-list {
        list-style: none;
        margin: 0;
        padding: 0;
        background: var(--panel);
        border: 1px solid var(--rule);
        border-radius: var(--radius-m);
        overflow: hidden;
      }
      .history-row {
        display: flex;
        align-items: center;
        padding-right: 4px;
      }
      .history-row + .history-row {
        border-top: 1px solid var(--rule);
      }
      .history-row:hover {
        background: var(--hover);
      }
      .row-open {
        flex: 1;
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        column-gap: 12px;
        row-gap: 2px;
        padding: 12px 8px 12px 16px;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .row-open:focus-visible {
        outline-offset: -2px;
      }
      .row-title {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .row-open:hover .row-title {
        color: var(--signal-ink);
      }
      .row-meta {
        grid-column: 1;
        display: flex;
        gap: 14px;
        font-size: 13px;
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
      }
      .jvm {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .row-time {
        grid-column: 2;
        grid-row: 1;
        font-size: 13px;
        color: var(--muted);
        white-space: nowrap;
      }
      .row-delete {
        color: var(--muted);
        opacity: 0;
      }
      .history-row:hover .row-delete,
      .row-delete:focus-visible {
        opacity: 1;
      }
      @media (hover: none) {
        .row-delete {
          opacity: 1;
        }
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

  protected remove(id: string): void {
    void this.stateService.deleteFromHistory(id);
  }

  protected relativeTime = relativeTime;
  protected formatDuration = formatDuration;
  protected formatBytes = formatBytes;

  protected absoluteTime(ms: number): string {
    return new Date(ms).toLocaleString();
  }
}
