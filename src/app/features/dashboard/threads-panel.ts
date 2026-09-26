import { Component, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { ParsedRecording, ThreadLifecycleEvent } from '../../core/jfr/models';
import { formatTimeAxisLabel } from '../../shared/formatters';

const TABLE_ROW_LIMIT = 100;

@Component({
  selector: 'app-threads-panel',
  standalone: true,
  imports: [NgxEchartsDirective, MatTableModule, MatChipsModule],
  template: `
    @if (recording().threadLifecycle.length === 0) {
      <p class="empty">No thread start/end events were recorded.</p>
    } @else {
      <div echarts [options]="chartOptions()" class="chart"></div>

      <h3>
        Thread lifecycle events
        @if (recording().threadLifecycle.length > tableRows().length) {
          <span class="hint">(showing first {{ tableRows().length }} of {{ recording().threadLifecycle.length }})</span>
        }
      </h3>
      <table mat-table [dataSource]="tableRows()" class="mat-elevation-z0">
        <ng-container matColumnDef="time">
          <th mat-header-cell *matHeaderCellDef>Time</th>
          <td mat-cell *matCellDef="let row">{{ formatTime(row.timeMs) }}</td>
        </ng-container>
        <ng-container matColumnDef="kind">
          <th mat-header-cell *matHeaderCellDef>Event</th>
          <td mat-cell *matCellDef="let row">
            <mat-chip [class.end]="row.kind === 'end'">{{ row.kind === 'start' ? 'Started' : 'Ended' }}</mat-chip>
          </td>
        </ng-container>
        <ng-container matColumnDef="thread">
          <th mat-header-cell *matHeaderCellDef>Thread</th>
          <td mat-cell *matCellDef="let row">{{ row.threadName }} (id {{ row.javaThreadId }})</td>
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
      .chart {
        width: 100%;
        height: 240px;
      }
      h3 {
        margin: 24px 0 8px;
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .hint {
        font-size: 12px;
        font-weight: 400;
        color: var(--mat-sys-on-surface-variant);
      }
      table {
        width: 100%;
      }
      mat-chip.end {
        opacity: 0.7;
      }
    `,
  ],
})
export class ThreadsPanelComponent {
  recording = input.required<ParsedRecording>();
  protected readonly columns = ['time', 'kind', 'thread'];

  protected tableRows = computed<ThreadLifecycleEvent[]>(() => this.recording().threadLifecycle.slice(0, TABLE_ROW_LIMIT));

  protected chartOptions = computed<EChartsCoreOption>(() => {
    const events = this.recording().threadLifecycle;
    let running = 0;
    const points: Array<[number, number]> = [];
    for (const e of events) {
      running += e.kind === 'start' ? 1 : -1;
      points.push([e.timeMs, running]);
    }
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 20, bottom: 60 },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => formatTimeAxisLabel(v) } },
      yAxis: { type: 'value', name: 'Live threads', min: 0 },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 8 }],
      series: [{ name: 'Live threads', type: 'line', step: 'end', showSymbol: false, data: points }],
    };
  });

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
  }
}
