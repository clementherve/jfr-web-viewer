import { Component, computed, input } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { FlameNode, ParsedRecording } from '../../core/jfr/models';
import { FlameGraphComponent } from '../flamegraph/flame-graph';
import { formatBytes } from '../../shared/formatters';

const ALLOCATION_PREFIX = '[allocation] ';

function collectTopClasses(node: FlameNode, out: Map<string, number>): void {
  if (node.name.startsWith(ALLOCATION_PREFIX)) {
    const className = node.name.slice(ALLOCATION_PREFIX.length);
    out.set(className, (out.get(className) ?? 0) + node.value);
  }
  for (const child of node.children) collectTopClasses(child, out);
}

@Component({
  selector: 'app-allocations-panel',
  standalone: true,
  imports: [NgxEchartsDirective, FlameGraphComponent],
  template: `
    @if (recording().allocationFlameGraph.value === 0) {
      <p class="empty">No allocation sampling events were recorded (enable the "profile" JFR settings template to capture these).</p>
    } @else {
      <h3>Top allocating classes</h3>
      <div echarts [options]="chartOptions()" class="chart"></div>

      <h3>Allocation flame graph</h3>
      <p class="hint">Weighted by sampled allocation size, not sample count.</p>
      <app-flame-graph [data]="recording().allocationFlameGraph" valueUnit="bytes" />
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
        margin: 0 0 8px;
      }
      .chart {
        width: 100%;
        height: 260px;
        margin-bottom: 8px;
      }
      h3 {
        margin: 24px 0 8px;
      }
    `,
  ],
})
export class AllocationsPanelComponent {
  recording = input.required<ParsedRecording>();

  protected topClasses = computed(() => {
    const counts = new Map<string, number>();
    collectTopClasses(this.recording().allocationFlameGraph, counts);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  });

  protected chartOptions = computed<EChartsCoreOption>(() => {
    const top = this.topClasses();
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => formatBytes(v as number) },
      grid: { left: 240, right: 40, top: 20, bottom: 20 },
      xAxis: { type: 'value', name: 'Bytes', axisLabel: { formatter: (v: number) => formatBytes(v) } },
      yAxis: { type: 'category', data: top.map(([name]) => name).reverse(), axisLabel: { width: 230, overflow: 'truncate' } },
      series: [{ type: 'bar', data: top.map(([, bytes]) => bytes).reverse() }],
    };
  });
}
