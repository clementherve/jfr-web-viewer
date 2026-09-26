import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { JfrParserService } from '../../core/jfr/jfr-parser.service';
import type { ParsedRecording, RawEventRow } from '../../core/jfr/models';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-events-browser-panel',
  standalone: true,
  imports: [MatIconModule, MatPaginatorModule, MatProgressBarModule],
  template: `
    <div class="browser">
      <aside class="types surface">
        <label class="filter">
          <mat-icon aria-hidden="true">search</mat-icon>
          <input type="search" placeholder="Filter event types" aria-label="Filter event types" [value]="filter()" (input)="filter.set($any($event.target).value)" />
        </label>
        <ul role="listbox" aria-label="Event types">
          @for (item of filteredTypes(); track item.typeName) {
            <li>
              <button
                type="button"
                role="option"
                [attr.aria-selected]="item.typeName === selectedType()"
                [class.selected]="item.typeName === selectedType()"
                (click)="onTypeChange(item.typeName)"
              >
                <span class="type-name code">{{ item.typeName }}</span>
                <span class="type-count num">{{ item.count.toLocaleString() }}</span>
              </button>
            </li>
          } @empty {
            <li class="hint no-match">No event types match "{{ filter() }}"</li>
          }
        </ul>
      </aside>

      <section class="events">
        <div class="events-head">
          <h3 class="code">{{ selectedType() }}</h3>
          <span class="hint num">{{ total().toLocaleString() }} events</span>
        </div>
        <mat-progress-bar [mode]="loading() ? 'indeterminate' : 'determinate'" [value]="0" [class.idle]="!loading()" />

        @if (!loading() && rows().length === 0) {
          <div class="empty-state">No events of this type.</div>
        } @else {
          <ol class="event-list" [class.stale]="loading()">
            @for (row of rowViews(); track row.offset) {
              <li class="event surface">
                <div class="event-time num">{{ row.timeMs != null ? formatTime(row.timeMs) : 'No timestamp' }}</div>
                <dl class="fields">
                  @for (field of row.fields; track field[0]) {
                    <dt>{{ field[0] }}</dt>
                    <dd class="code">{{ field[1] }}</dd>
                  }
                </dl>
              </li>
            }
          </ol>
          <mat-paginator [length]="total()" [pageSize]="pageSize" [pageIndex]="pageIndex()" (page)="onPage($event)" />
        }
      </section>
    </div>
  `,
  styles: [
    `
      .browser {
        display: grid;
        grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }
      .types {
        position: sticky;
        top: 16px;
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 32px);
        overflow: hidden;
      }
      .filter {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--rule);
        color: var(--muted);
      }
      .filter mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .filter input {
        flex: 1;
        min-width: 0;
        border: 0;
        background: none;
        color: var(--ink);
        font: inherit;
        outline: none;
      }
      .filter:focus-within {
        box-shadow: inset 0 -2px 0 var(--signal);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 4px;
        overflow-y: auto;
      }
      li button {
        display: flex;
        align-items: baseline;
        gap: 8px;
        width: 100%;
        padding: 6px 8px;
        border: 0;
        border-radius: var(--radius-s);
        background: none;
        color: var(--ink);
        text-align: left;
        cursor: pointer;
      }
      li button:hover {
        background: var(--hover);
      }
      li button.selected {
        background: var(--signal-wash);
        color: var(--signal-ink);
      }
      .type-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .type-count {
        font-size: 12px;
        color: var(--muted);
      }
      .no-match {
        padding: 12px 8px;
      }
      .events-head {
        display: flex;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 8px;
      }
      .events-head h3 {
        margin: 0;
        font-size: 14px;
        overflow-wrap: anywhere;
      }
      mat-progress-bar {
        margin-bottom: 12px;
      }
      mat-progress-bar.idle {
        visibility: hidden;
      }
      .event-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        transition: opacity 0.15s ease;
      }
      .event-list.stale {
        opacity: 0.5;
      }
      .event {
        padding: 10px 14px;
      }
      .event-time {
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 6px;
      }
      .fields {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        column-gap: 16px;
        row-gap: 2px;
        margin: 0;
        font-size: 13px;
      }
      .fields dt {
        color: var(--muted);
      }
      .fields dd {
        margin: 0;
        overflow-wrap: anywhere;
        max-height: 12em;
        overflow-y: auto;
        white-space: pre-wrap;
      }
      mat-paginator {
        background: transparent;
      }
      @media (max-width: 900px) {
        .browser {
          grid-template-columns: minmax(0, 1fr);
        }
        .types {
          position: static;
          max-height: 280px;
        }
      }
    `,
  ],
})
export class EventsBrowserPanelComponent {
  recording = input.required<ParsedRecording>();

  private readonly parser = inject(JfrParserService);
  protected readonly pageSize = PAGE_SIZE;

  protected selectedType = signal<string | null>(null);
  protected filter = signal('');
  protected pageIndex = signal(0);
  protected rows = signal<RawEventRow[]>([]);
  protected total = signal(0);
  protected loading = signal(false);

  protected filteredTypes = computed(() => {
    const term = this.filter().trim().toLowerCase();
    const types = this.recording().eventTypeSummary;
    return term ? types.filter((t) => t.typeName.toLowerCase().includes(term)) : types;
  });

  protected rowViews = computed(() =>
    this.rows().map((row) => ({
      offset: row.offset,
      timeMs: row.timeMs,
      fields: Object.entries(row.fields).map(([key, value]): [string, string] => [
        key,
        value !== null && typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value),
      ]),
    })),
  );

  constructor() {
    effect(() => {
      const types = this.recording().eventTypeSummary;
      if (!this.selectedType() && types.length > 0) {
        this.selectedType.set(types[0].typeName);
      }
    });

    effect(() => {
      const type = this.selectedType();
      const page = this.pageIndex();
      if (!type) return;
      this.loading.set(true);
      this.parser.browseEvents(type, page * this.pageSize, this.pageSize).then(({ rows, total }) => {
        // Ignore responses for a type or page the user has already moved away from.
        if (type !== this.selectedType() || page !== this.pageIndex()) return;
        this.rows.set(rows);
        this.total.set(total);
        this.loading.set(false);
      });
    });
  }

  protected onTypeChange(type: string): void {
    this.selectedType.set(type);
    this.pageIndex.set(0);
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
  }

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
  }

}
