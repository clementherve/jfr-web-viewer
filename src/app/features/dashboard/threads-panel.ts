import { Component, computed, inject, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { ParsedRecording, ThreadLifecycleEvent } from '../../core/jfr/models';
import { formatTimeAxisLabel } from '../../shared/formatters';
import { ThemeService } from '../../shared/theme.service';
import { TIME_AXIS_ZOOM } from './chart-defaults';

const TABLE_ROW_LIMIT = 100;

@Component({
  selector: 'app-threads-panel',
  standalone: true,
  imports: [NgxEchartsDirective, MatTableModule],
  template: `
    @if (recording().threadLifecycle.length === 0) {
      <div class="empty-state"><strong>No thread start or end events</strong>The recording has no jdk.ThreadStart or jdk.ThreadEnd events.</div>
    } @else {
      <dl class="readout">
        <div>
          <dt>Threads started</dt>
          <dd>{{ stats().started.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Threads ended</dt>
          <dd>{{ stats().ended.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Largest net increase</dt>
          <dd>{{ stats().peak.toLocaleString() }}</dd>
        </div>
      </dl>

      <section class="panel-section">
        <h3>Change in live threads <span class="hint">Relative to the start of the recording</span></h3>
        <div echarts [options]="chartOptions()" [theme]="theme.chartTheme()" class="chart surface"></div>
      </section>

      <section class="panel-section">
        <h3>
          Start and end events
          @if (recording().threadLifecycle.length > tableRows().length) {
            <span class="hint">First {{ tableRows().length }} of {{ recording().threadLifecycle.length.toLocaleString() }}</span>
          }
        </h3>
        <div class="surface data-table-wrap">
          <table mat-table [dataSource]="tableRows()">
            <ng-container matColumnDef="time">
              <th mat-header-cell *matHeaderCellDef>At</th>
              <td mat-cell *matCellDef="let row" class="num">{{ formatTime(row.timeMs) }}</td>
            </ng-container>
            <ng-container matColumnDef="kind">
              <th mat-header-cell *matHeaderCellDef>Event</th>
              <td mat-cell *matCellDef="let row">
                <span class="kind" [class.end]="row.kind === 'end'">{{ row.kind === 'start' ? 'Started' : 'Ended' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="thread">
              <th mat-header-cell *matHeaderCellDef>Thread</th>
              <td mat-cell *matCellDef="let row">
                <span class="code">{{ row.threadName }}</span> <span class="hint">#{{ row.javaThreadId }}</span>
              </td>
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
      .kind {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .kind::before {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--signal);
      }
      .kind.end::before {
        background: transparent;
        border: 1.5px solid var(--muted);
        box-sizing: border-box;
      }
    `,
  ],
})
export class ThreadsPanelComponent {
  recording = input.required<ParsedRecording>();
  protected readonly columns = ['time', 'kind', 'thread'];
  protected readonly theme = inject(ThemeService);

  protected stats = computed(() => {
    const events = this.recording().threadLifecycle;
    let running = 0;
    let peak = 0;
    let started = 0;
    for (const e of events) {
      if (e.kind === 'start') started++;
      running += e.kind === 'start' ? 1 : -1;
      peak = Math.max(peak, running);
    }
    return { started, ended: events.length - started, peak };
  });

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
      grid: { left: 56, right: 24, top: 24, bottom: 56 },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => formatTimeAxisLabel(v) } },
      yAxis: { type: 'value', minInterval: 1 },
      dataZoom: TIME_AXIS_ZOOM,
      series: [{ name: 'Change in live threads', type: 'line', step: 'end', areaStyle: { opacity: 0.15 }, data: points }],
    };
  });

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
  }
}
