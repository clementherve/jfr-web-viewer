import { Component, effect, inject, input, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { JfrParserService } from '../../core/jfr/jfr-parser.service';
import type { ParsedRecording, RawEventRow } from '../../core/jfr/models';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-events-browser-panel',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, MatTableModule, MatPaginatorModule],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="type-select">
      <mat-label>Event type</mat-label>
      <mat-select [value]="selectedType()" (selectionChange)="onTypeChange($event.value)">
        @for (item of recording().eventTypeSummary; track item.typeName) {
          <mat-option [value]="item.typeName">{{ item.typeName }} ({{ item.count.toLocaleString() }})</mat-option>
        }
      </mat-select>
    </mat-form-field>

    @if (loading()) {
      <p class="hint">Loading…</p>
    } @else if (rows().length === 0) {
      <p class="empty">No events of this type.</p>
    } @else {
      <table mat-table [dataSource]="rows()" class="mat-elevation-z0">
        <ng-container matColumnDef="time">
          <th mat-header-cell *matHeaderCellDef>Time</th>
          <td mat-cell *matCellDef="let row">{{ row.timeMs != null ? formatTime(row.timeMs) : '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="fields">
          <th mat-header-cell *matHeaderCellDef>Fields</th>
          <td mat-cell *matCellDef="let row"><pre class="fields">{{ formatFields(row) }}</pre></td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      <mat-paginator [length]="total()" [pageSize]="pageSize" [pageIndex]="pageIndex()" (page)="onPage($event)" />
    }
  `,
  styles: [
    `
      .type-select {
        width: 360px;
        margin-bottom: 12px;
      }
      .empty,
      .hint {
        color: var(--mat-sys-on-surface-variant);
        padding: 12px 0;
      }
      table {
        width: 100%;
      }
      .fields {
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
        margin: 8px 0;
      }
    `,
  ],
})
export class EventsBrowserPanelComponent {
  recording = input.required<ParsedRecording>();

  private readonly parser = inject(JfrParserService);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly columns = ['time', 'fields'];

  protected selectedType = signal<string | null>(null);
  protected pageIndex = signal(0);
  protected rows = signal<RawEventRow[]>([]);
  protected total = signal(0);
  protected loading = signal(false);

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

  protected formatFields(row: RawEventRow): string {
    return JSON.stringify(row.fields, null, 1);
  }
}
