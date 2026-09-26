import { Component, computed, inject, input } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { ParsedRecording } from '../../core/jfr/models';
import { formatBytes, formatDurationMsPrecise, formatTimeAxisLabel } from '../../shared/formatters';
import { ThemeService } from '../../shared/theme.service';
import { TIME_AXIS_ZOOM } from './chart-defaults';

function percent(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

@Component({
  selector: 'app-overview-panel',
  standalone: true,
  imports: [NgxEchartsDirective],
  template: `
    <dl class="readout">
      <div>
        <dt>Average JVM CPU</dt>
        <dd>{{ summary().avgCpu }}</dd>
      </div>
      <div>
        <dt>Peak JVM CPU</dt>
        <dd>{{ summary().peakCpu }}</dd>
      </div>
      <div>
        <dt>Peak heap used</dt>
        <dd>{{ summary().peakHeap }}</dd>
      </div>
      <div>
        <dt>Time paused for GC</dt>
        <dd>{{ summary().gcPause }}</dd>
      </div>
    </dl>

    <section class="panel-section">
      <h3>CPU usage</h3>
      @if (recording().cpuLoad.length > 0) {
        <div echarts [options]="cpuChartOptions()" [theme]="theme.chartTheme()" class="chart surface"></div>
      } @else {
        <div class="empty-state"><strong>No CPU load samples</strong>The recording has no jdk.CPULoad events.</div>
      }
    </section>

    <section class="panel-section">
      <h3>Heap</h3>
      @if (recording().heap.length > 0) {
        <div echarts [options]="heapChartOptions()" [theme]="theme.chartTheme()" class="chart surface"></div>
      } @else {
        <div class="empty-state"><strong>No heap samples</strong>The recording has no jdk.GCHeapSummary or jdk.GCHeapMemoryUsage events.</div>
      }
    </section>

    <section class="panel-section">
      <h3>JVM</h3>
      <dl class="facts surface">
        <div>
          <dt>Name</dt>
          <dd>{{ recording().metadata.jvmName || 'Unknown' }}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{{ recording().metadata.jvmVersion || 'Unknown' }}</dd>
        </div>
        <div>
          <dt>Operating system</dt>
          <dd>{{ recording().metadata.osVersion || 'Unknown' }}</dd>
        </div>
        <div>
          <dt>Process ID</dt>
          <dd class="num">{{ recording().metadata.pid || 'Unknown' }}</dd>
        </div>
        <div>
          <dt>Recording started</dt>
          <dd>{{ startedAt() }}</dd>
        </div>
        @if (recording().metadata.javaArguments) {
          <div class="wide">
            <dt>Application arguments</dt>
            <dd class="code">{{ recording().metadata.javaArguments }}</dd>
          </div>
        }
        @if (recording().metadata.jvmArguments) {
          <div class="wide">
            <dt>JVM flags</dt>
            <dd class="code">{{ recording().metadata.jvmArguments }}</dd>
          </div>
        }
      </dl>
    </section>
  `,
  styles: [
    `
      .facts {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        margin: 0;
      }
      .facts > div {
        padding: 12px 18px;
        border-top: 1px solid var(--rule);
        margin-top: -1px;
        min-width: 0;
      }
      .facts .wide {
        grid-column: 1 / -1;
      }
      dt {
        font-size: 13px;
        color: var(--muted);
      }
      dd {
        margin: 2px 0 0;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class OverviewPanelComponent {
  recording = input.required<ParsedRecording>();
  protected readonly theme = inject(ThemeService);

  protected startedAt = computed(() => {
    const ms = this.recording().metadata.startTimeMs;
    return ms ? new Date(ms).toLocaleString() : 'Unknown';
  });

  protected summary = computed(() => {
    const r = this.recording();
    const jvm = r.cpuLoad.map((d) => d.jvmUser + d.jvmSystem);
    const peakHeap = r.heap.reduce((max, h) => Math.max(max, h.heapUsedBytes), 0);
    const gcMs = r.gcPauses.reduce((sum, p) => sum + p.durationMs, 0);
    return {
      avgCpu: jvm.length ? percent(jvm.reduce((a, b) => a + b, 0) / jvm.length) : 'n/a',
      peakCpu: jvm.length ? percent(Math.max(...jvm)) : 'n/a',
      peakHeap: r.heap.length ? formatBytes(peakHeap) : 'n/a',
      gcPause: r.gcPauses.length ? formatDurationMsPrecise(gcMs) : 'n/a',
    };
  });

  protected cpuChartOptions = computed<EChartsCoreOption>(() => {
    const data = this.recording().cpuLoad;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => percent(v as number) },
      legend: { top: 4, data: ['JVM user', 'JVM system', 'Whole machine'] },
      grid: { left: 56, right: 24, top: 40, bottom: 56 },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => formatTimeAxisLabel(v) } },
      yAxis: { type: 'value', min: 0, max: 1, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` } },
      dataZoom: TIME_AXIS_ZOOM,
      series: [
        { name: 'JVM user', type: 'line', stack: 'jvm', areaStyle: { opacity: 0.25 }, data: data.map((d) => [d.timeMs, d.jvmUser]) },
        { name: 'JVM system', type: 'line', stack: 'jvm', areaStyle: { opacity: 0.25 }, data: data.map((d) => [d.timeMs, d.jvmSystem]) },
        { name: 'Whole machine', type: 'line', lineStyle: { type: 'dashed' }, data: data.map((d) => [d.timeMs, d.machineTotal]) },
      ],
    };
  });

  protected heapChartOptions = computed<EChartsCoreOption>(() => {
    const data = this.recording().heap;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => formatBytes(v as number) },
      legend: { top: 4, data: ['Used', 'Committed'] },
      grid: { left: 72, right: 24, top: 40, bottom: 56 },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => formatTimeAxisLabel(v) } },
      yAxis: { type: 'value', min: 0, axisLabel: { formatter: (v: number) => formatBytes(v) } },
      dataZoom: TIME_AXIS_ZOOM,
      series: [
        { name: 'Used', type: 'line', areaStyle: { opacity: 0.2 }, data: data.map((d) => [d.timeMs, d.heapUsedBytes]) },
        { name: 'Committed', type: 'line', step: 'end', lineStyle: { type: 'dashed' }, data: data.map((d) => [d.timeMs, d.heapCommittedBytes]) },
      ],
    };
  });
}
