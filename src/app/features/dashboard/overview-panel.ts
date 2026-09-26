import { Component, computed, input } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { ParsedRecording } from '../../core/jfr/models';
import { formatBytes, formatDuration, formatTimeAxisLabel } from '../../shared/formatters';

@Component({
  selector: 'app-overview-panel',
  standalone: true,
  imports: [NgxEchartsDirective],
  template: `
    <div class="metadata-grid">
      <div class="metadata-item">
        <span class="label">JVM</span>
        <span class="value">{{ recording().metadata.jvmName || 'Unknown' }}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Version</span>
        <span class="value">{{ recording().metadata.jvmVersion || 'Unknown' }}</span>
      </div>
      <div class="metadata-item">
        <span class="label">PID</span>
        <span class="value">{{ recording().metadata.pid || 'Unknown' }}</span>
      </div>
      <div class="metadata-item">
        <span class="label">OS</span>
        <span class="value">{{ recording().metadata.osVersion || 'Unknown' }}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Recording duration</span>
        <span class="value">{{ formatDuration(recording().metadata.durationMs) }}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Started</span>
        <span class="value">{{ startedAt() }}</span>
      </div>
      @if (recording().metadata.javaArguments) {
        <div class="metadata-item wide">
          <span class="label">Java arguments</span>
          <span class="value code">{{ recording().metadata.javaArguments }}</span>
        </div>
      }
      @if (recording().metadata.jvmArguments) {
        <div class="metadata-item wide">
          <span class="label">JVM arguments</span>
          <span class="value code">{{ recording().metadata.jvmArguments }}</span>
        </div>
      }
    </div>

    <h3>CPU usage</h3>
    @if (recording().cpuLoad.length > 0) {
      <div echarts [options]="cpuChartOptions()" class="chart"></div>
    } @else {
      <p class="empty">No jdk.CPULoad events were recorded.</p>
    }

    <h3>Heap usage</h3>
    @if (recording().heap.length > 0) {
      <div echarts [options]="heapChartOptions()" class="chart"></div>
    } @else {
      <p class="empty">No heap usage events (jdk.GCHeapSummary or jdk.GCHeapMemoryUsage) were recorded.</p>
    }
  `,
  styles: [
    `
      .metadata-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      .metadata-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .metadata-item.wide {
        grid-column: 1 / -1;
      }
      .label {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .value {
        font-size: 14px;
        overflow-wrap: break-word;
      }
      .value.code {
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
      }
      h3 {
        margin: 24px 0 8px;
      }
      .chart {
        width: 100%;
        height: 260px;
      }
      .empty {
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
})
export class OverviewPanelComponent {
  recording = input.required<ParsedRecording>();

  protected formatDuration = formatDuration;

  protected startedAt = computed(() => {
    const ms = this.recording().metadata.startTimeMs;
    return ms ? new Date(ms).toLocaleString() : 'Unknown';
  });

  protected cpuChartOptions = computed<EChartsCoreOption>(() => {
    const data = this.recording().cpuLoad;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${((v as number) * 100).toFixed(1)}%` },
      legend: { data: ['JVM user', 'JVM system', 'Machine total'] },
      grid: { left: 50, right: 20, top: 40, bottom: 60 },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => formatTimeAxisLabel(v) } },
      yAxis: { type: 'value', min: 0, max: 1, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` } },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 8 }],
      series: [
        { name: 'JVM user', type: 'line', showSymbol: false, data: data.map((d) => [d.timeMs, d.jvmUser]) },
        { name: 'JVM system', type: 'line', showSymbol: false, data: data.map((d) => [d.timeMs, d.jvmSystem]) },
        { name: 'Machine total', type: 'line', showSymbol: false, data: data.map((d) => [d.timeMs, d.machineTotal]) },
      ],
    };
  });

  protected heapChartOptions = computed<EChartsCoreOption>(() => {
    const data = this.recording().heap;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => formatBytes(v as number) },
      grid: { left: 70, right: 20, top: 20, bottom: 60 },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => formatTimeAxisLabel(v) } },
      yAxis: { type: 'value', min: 0, axisLabel: { formatter: (v: number) => formatBytes(v) } },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 8 }],
      series: [
        {
          name: 'Heap used',
          type: 'line',
          showSymbol: false,
          areaStyle: {},
          data: data.map((d) => [d.timeMs, d.heapUsedBytes]),
        },
      ],
    };
  });
}
