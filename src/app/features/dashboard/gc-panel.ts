import { Component, computed, inject, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { GcPauseEvent, ParsedRecording } from '../../core/jfr/models';
import { formatDurationMsPrecise, formatTimeAxisLabel } from '../../shared/formatters';
import { ThemeService } from '../../shared/theme.service';
import { TIME_AXIS_ZOOM } from './chart-defaults';

@Component({
  selector: 'app-gc-panel',
  standalone: true,
  imports: [NgxEchartsDirective, MatTableModule],
  template: `
    @if (recording().gcPauses.length === 0) {
      <div class="empty-state"><strong>No garbage collection pauses</strong>The recording has no GC pause events.</div>
    } @else {
      <dl class="readout">
        <div>
          <dt>Pauses</dt>
          <dd>{{ stats().count.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Total time paused</dt>
          <dd>{{ formatDurationMsPrecise(stats().totalMs) }}</dd>
        </div>
        <div>
          <dt>Share of recording</dt>
          <dd>{{ stats().share }}</dd>
        </div>
        <div>
          <dt>Longest pause</dt>
          <dd>{{ formatDurationMsPrecise(stats().maxMs) }}</dd>
        </div>
        <div>
          <dt>Average pause</dt>
          <dd>{{ formatDurationMsPrecise(stats().avgMs) }}</dd>
        </div>
      </dl>

      <section class="panel-section">
        <h3>Pauses over time <span class="hint">Each dot is one pause. Higher means your app stood still longer.</span></h3>
        <div echarts [options]="chartOptions()" [theme]="theme.chartTheme()" class="chart surface"></div>
      </section>

      <section class="panel-section">
        <h3>Longest pauses <span class="hint">Top {{ longestPauses().length }}</span></h3>
        <div class="surface data-table-wrap">
          <table mat-table [dataSource]="longestPauses()">
            <ng-container matColumnDef="duration">
              <th mat-header-cell *matHeaderCellDef class="right">Duration</th>
              <td mat-cell *matCellDef="let row" class="right strong">{{ formatDurationMsPrecise(row.durationMs) }}</td>
            </ng-container>
            <ng-container matColumnDef="cause">
              <th mat-header-cell *matHeaderCellDef>Cause</th>
              <td mat-cell *matCellDef="let row">{{ row.cause }}</td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Collector</th>
              <td mat-cell *matCellDef="let row">{{ row.name }}</td>
            </ng-container>
            <ng-container matColumnDef="time">
              <th mat-header-cell *matHeaderCellDef class="right">At</th>
              <td mat-cell *matCellDef="let row" class="right">{{ formatTime(row.timeMs) }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .strong {
        font-weight: 600;
      }
    `,
  ],
})
export class GcPanelComponent {
  recording = input.required<ParsedRecording>();
  protected readonly columns = ['duration', 'cause', 'name', 'time'];
  protected readonly theme = inject(ThemeService);

  protected formatDurationMsPrecise = formatDurationMsPrecise;

  protected stats = computed(() => {
    const pauses = this.recording().gcPauses;
    const totalMs = pauses.reduce((sum, p) => sum + p.durationMs, 0);
    const maxMs = pauses.reduce((max, p) => Math.max(max, p.durationMs), 0);
    const durationMs = this.recording().metadata.durationMs;
    const share = durationMs > 0 ? `${((totalMs / durationMs) * 100).toFixed(2)}%` : 'n/a';
    return { count: pauses.length, totalMs, maxMs, share, avgMs: pauses.length ? totalMs / pauses.length : 0 };
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
      legend: { top: 4, data: Array.from(byName.keys()) },
      grid: { left: 64, right: 24, top: 40, bottom: 56 },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => formatTimeAxisLabel(v) } },
      yAxis: { type: 'value', min: 0, axisLabel: { formatter: (v: number) => `${v} ms` } },
      dataZoom: TIME_AXIS_ZOOM,
      series: Array.from(byName.entries()).map(([name, pauses]) => ({
        name,
        type: 'scatter',
        symbolSize: 7,
        itemStyle: { opacity: 0.8 },
        data: pauses.map((p) => [p.timeMs, p.durationMs]),
      })),
    };
  });

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
  }
}
