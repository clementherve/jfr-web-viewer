import { Component, computed, inject, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { ExceptionEvent, ParsedRecording } from '../../core/jfr/models';
import { ThemeService } from '../../shared/theme.service';

const TABLE_ROW_LIMIT = 100;

@Component({
  selector: 'app-exceptions-panel',
  standalone: true,
  imports: [NgxEchartsDirective, MatTableModule],
  template: `
    @if (recording().exceptions.length === 0) {
      <div class="empty-state">
        <strong>No exceptions recorded</strong>
        Exception events (jdk.JavaExceptionThrow) are off by default. Enable them in a custom JFR settings file to see throws here.
      </div>
    } @else {
      <dl class="readout">
        <div>
          <dt>Exceptions thrown</dt>
          <dd>{{ recording().exceptions.length.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Distinct classes</dt>
          <dd>{{ classCounts().length.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Per second</dt>
          <dd>{{ perSecond() }}</dd>
        </div>
      </dl>

      <section class="panel-section">
        <h3>Most thrown classes</h3>
        <div echarts [options]="chartOptions()" [theme]="theme.chartTheme()" class="chart surface" [style.height.px]="barChartHeight()"></div>
      </section>

      <section class="panel-section">
        <h3>
          Throws
          @if (recording().exceptions.length > tableRows().length) {
            <span class="hint">First {{ tableRows().length }} of {{ recording().exceptions.length.toLocaleString() }}</span>
          }
        </h3>
        <div class="surface data-table-wrap">
          <table mat-table [dataSource]="tableRows()">
            <ng-container matColumnDef="time">
              <th mat-header-cell *matHeaderCellDef>At</th>
              <td mat-cell *matCellDef="let row" class="num">{{ formatTime(row.timeMs) }}</td>
            </ng-container>
            <ng-container matColumnDef="class">
              <th mat-header-cell *matHeaderCellDef>Class</th>
              <td mat-cell *matCellDef="let row" class="code">{{ row.thrownClass }}</td>
            </ng-container>
            <ng-container matColumnDef="message">
              <th mat-header-cell *matHeaderCellDef>Message</th>
              <td mat-cell *matCellDef="let row" [class.hint]="!row.message">{{ row.message || 'No message' }}</td>
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
      td.code {
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class ExceptionsPanelComponent {
  recording = input.required<ParsedRecording>();
  protected readonly columns = ['time', 'class', 'message'];
  protected readonly theme = inject(ThemeService);

  protected classCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const e of this.recording().exceptions) {
      counts.set(e.thrownClass, (counts.get(e.thrownClass) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  });

  protected perSecond = computed(() => {
    const seconds = this.recording().metadata.durationMs / 1000;
    return seconds > 0 ? (this.recording().exceptions.length / seconds).toFixed(1) : 'n/a';
  });

  protected barChartHeight = computed(() => Math.min(10, this.classCounts().length) * 32 + 40);

  protected tableRows = computed<ExceptionEvent[]>(() => this.recording().exceptions.slice(0, TABLE_ROW_LIMIT));

  protected chartOptions = computed<EChartsCoreOption>(() => {
    const top = this.classCounts().slice(0, 10).reverse();
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 16, right: 48, top: 12, bottom: 24, containLabel: true },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', data: top.map(([name]) => name), axisLabel: { width: 320, overflow: 'truncate' } },
      series: [{ name: 'Throws', type: 'bar', barMaxWidth: 18, label: { show: true, position: 'right' }, data: top.map(([, count]) => count) }],
    };
  });

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
  }
}
