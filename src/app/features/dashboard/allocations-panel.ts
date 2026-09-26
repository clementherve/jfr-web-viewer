import { Component, computed, inject, input } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { FlameNode, ParsedRecording } from '../../core/jfr/models';
import { FlameGraphComponent } from '../flamegraph/flame-graph';
import { formatBytes } from '../../shared/formatters';
import { ThemeService } from '../../shared/theme.service';

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
      <div class="empty-state">
        <strong>No allocation samples</strong>
        Allocation sampling is off in the default JFR settings. Record with <code class="code">settings=profile</code> to capture it.
      </div>
    } @else {
      <section class="panel-section">
        <h3>Top allocating classes</h3>
        <div echarts [options]="chartOptions()" [theme]="theme.chartTheme()" class="chart surface" [style.height.px]="topClasses().length * 32 + 40"></div>
      </section>

      <section class="panel-section">
        <h3>Allocation call paths <span class="hint">Weighted by sampled allocation size, not sample count</span></h3>
        <app-flame-graph [data]="recording().allocationFlameGraph" valueUnit="bytes" />
      </section>
    }
  `,
})
export class AllocationsPanelComponent {
  recording = input.required<ParsedRecording>();
  protected readonly theme = inject(ThemeService);

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
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: unknown) => formatBytes(v as number) },
      grid: { left: 16, right: 72, top: 12, bottom: 24, containLabel: true },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatBytes(v) } },
      yAxis: { type: 'category', data: top.map(([name]) => name).reverse(), axisLabel: { width: 320, overflow: 'truncate' } },
      series: [
        {
          name: 'Allocated',
          type: 'bar',
          barMaxWidth: 18,
          label: { show: true, position: 'right', formatter: (p: { value: number }) => formatBytes(p.value) },
          data: top.map(([, bytes]) => bytes).reverse(),
        },
      ],
    };
  });
}
