import { Component, computed, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { GcPauseEvent, ParsedRecording } from '../../core/jfr/models';
import { formatDurationMsPrecise, formatTimeAxisLabel } from '../../shared/formatters';

@Component({
  selector: 'app-gc-panel',
  standalone: true,
  imports: [NgxEchartsDirective, MatTableModule],
  template: `
    @if (recording().gcPauses.length === 0) {
      <p class="empty">No garbage collection events were recorded.</p>
    } @else {
      <div class="stats-row">
        <div class="stat">
          <span class="stat-value">{{ stats().count }}</span>
          <span class="stat-label">GC pauses</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ formatDurationMsPrecise(stats().totalMs) }}</span>
          <span class="stat-label">Total pause time</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ formatDurationMsPrecise(stats().maxMs) }}</span>
          <span class="stat-label">Longest pause</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ formatDurationMsPrecise(stats().avgMs) }}</span>
          <span class="stat-label">Average pause</span>
        </div>
      </div>

      <div echarts [options]="chartOptions()" class="chart"></div>

      <h3>Longest pauses</h3>
      <table mat-table [dataSource]="longestPauses()" class="mat-elevation-z0">
        <ng-container matColumnDef="time">
          <th mat-header-cell *matHeaderCellDef>Time</th>
          <td mat-cell *matCellDef="let row">{{ formatTime(row.timeMs) }}</td>
        </ng-container>
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Collector</th>
          <td mat-cell *matCellDef="let row">{{ row.name }}</td>
        </ng-container>
        <ng-container matColumnDef="cause">
          <th mat-header-cell *matHeaderCellDef>Cause</th>
          <td mat-cell *matCellDef="let row">{{ row.cause }}</td>
        </ng-container>
        <ng-container matColumnDef="duration">
          <th mat-header-cell *matHeaderCellDef>Duration</th>
          <td mat-cell *matCellDef="let row">{{ formatDurationMsPrecise(row.durationMs) }}</td>
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
      .stats-row {
        display: flex;
        gap: 32px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .stat {
        display: flex;
        flex-direction: column;
      }
      .stat-value {
        font-size: 22px;
        font-weight: 500;
      }
      .stat-label {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
      .chart {
        width: 100%;
        height: 260px;
      }
      h3 {
        margin: 24px 0 8px;
      }
      table {
        width: 100%;
      }
    `,
  ],
})
export class GcPanelComponent {
  recording = input.required<ParsedRecording>();
  protected readonly columns = ['time', 'name', 'cause', 'duration'];

  protected formatDurationMsPrecise = formatDurationMsPrecise;

  protected stats = computed(() => {
    const pauses = this.recording().gcPauses;
    const totalMs = pauses.reduce((sum, p) => sum + p.durationMs, 0);
    const maxMs = pauses.reduce((max, p) => Math.max(max, p.durationMs), 0);
    return { count: pauses.length, totalMs, maxMs, avgMs: pauses.length ? totalMs / pauses.length : 0 };
  });

  protected longestPauses = computed<GcPauseEvent[]>(() => [...this.recording().gcPauses].sort((a, b) => b.durationMs - a.durationMs).slice(0, 20));

  protected chartOptions = computed<EChartsCoreOption>(() => {
    const byName = new Map<string, GcPauseEvent[]>();
    for (const p of this.recording().gcPauses) {
      const list = byName.get(p.name) ?? [];
      list.push(p);
      byName.set(p.name, list);
    }
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const point = p as { seriesName: string; value: [number, number] };
          return `${point.seriesName}<br/>${formatTimeAxisLabel(point.value[0])}: ${formatDurationMsPrecise(point.value[1])}`;
        },
      },
      legend: { data: Array.from(byName.keys()) },
      grid: { left: 60, right: 20, top: 40, bottom: 60 },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => formatTimeAxisLabel(v) } },
      yAxis: { type: 'value', name: 'Pause (ms)', min: 0 },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 8 }],
      series: Array.from(byName.entries()).map(([name, pauses]) => ({
        name,
        type: 'scatter',
        symbolSize: 8,
        data: pauses.map((p) => [p.timeMs, p.durationMs]),
      })),
    };
  });

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
  }
}
