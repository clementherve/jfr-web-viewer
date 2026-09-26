import { Component, computed, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { ExceptionEvent, ParsedRecording } from '../../core/jfr/models';

const TABLE_ROW_LIMIT = 100;

@Component({
  selector: 'app-exceptions-panel',
  standalone: true,
  imports: [NgxEchartsDirective, MatTableModule],
  template: `
    @if (recording().exceptions.length === 0) {
      <p class="empty">No exception throw events were recorded.</p>
    } @else {
      <p class="hint">{{ recording().exceptions.length }} exceptions thrown during this recording.</p>
      <div echarts [options]="chartOptions()" class="chart"></div>

      <h3>
        Recent throws
        @if (recording().exceptions.length > tableRows().length) {
          <span class="hint">(showing first {{ tableRows().length }} of {{ recording().exceptions.length }})</span>
        }
      </h3>
      <table mat-table [dataSource]="tableRows()" class="mat-elevation-z0">
        <ng-container matColumnDef="time">
          <th mat-header-cell *matHeaderCellDef>Time</th>
          <td mat-cell *matCellDef="let row">{{ formatTime(row.timeMs) }}</td>
        </ng-container>
        <ng-container matColumnDef="class">
          <th mat-header-cell *matHeaderCellDef>Exception class</th>
          <td mat-cell *matCellDef="let row">{{ row.thrownClass }}</td>
        </ng-container>
        <ng-container matColumnDef="message">
          <th mat-header-cell *matHeaderCellDef>Message</th>
          <td mat-cell *matCellDef="let row">{{ row.message || '—' }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    }
  `,
  styles: [
    `
      .empty {
        color: var(--mat-sys-on-surface-variant);
        text-align: center;
        padding: 24px 0;
      }
      .hint {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
      .chart {
        width: 100%;
        height: 260px;
      }
      h3 {
        margin: 24px 0 8px;
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      table {
        width: 100%;
      }
    `,
  ],
})
export class ExceptionsPanelComponent {
  recording = input.required<ParsedRecording>();
  protected readonly columns = ['time', 'class', 'message'];

  protected tableRows = computed<ExceptionEvent[]>(() => this.recording().exceptions.slice(0, TABLE_ROW_LIMIT));

  protected chartOptions = computed<EChartsCoreOption>(() => {
    const counts = new Map<string, number>();
    for (const e of this.recording().exceptions) {
      counts.set(e.thrownClass, (counts.get(e.thrownClass) ?? 0) + 1);
    }
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 200, right: 40, top: 20, bottom: 20, containLabel: false },
      xAxis: { type: 'value', name: 'Count' },
      yAxis: { type: 'category', data: top.map(([name]) => name).reverse(), axisLabel: { width: 190, overflow: 'truncate' } },
      series: [{ type: 'bar', data: top.map(([, count]) => count).reverse() }],
    };
  });

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
  }
}
