import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, effect, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';
import flamegraph, { type FlameGraphChart, type FlameGraphHierarchyNode } from 'd3-flame-graph';
import type { FlameNode } from '../../core/jfr/models';

function formatValue(value: number, unit: 'samples' | 'bytes'): string {
  if (unit === 'samples') return `${value.toLocaleString()} samples`;
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

@Component({
  selector: 'app-flame-graph',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <div class="flame-toolbar">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
        <mat-label>Search frames</mat-label>
        <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearch($event)" placeholder="e.g. Sample.fib" />
      </mat-form-field>
      <button mat-stroked-button (click)="onResetZoom()">
        <mat-icon>zoom_out_map</mat-icon>
        Reset zoom
      </button>
      <span class="total">Total: {{ formatTotal() }}</span>
    </div>
    <div class="flame-container" #container></div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .flame-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }
      .search-field {
        width: 260px;
      }
      .total {
        color: var(--mat-sys-on-surface-variant);
        font-size: 13px;
        margin-left: auto;
      }
      .flame-container {
        width: 100%;
        min-height: 400px;
        overflow-x: hidden;
      }
    `,
  ],
})
export class FlameGraphComponent implements AfterViewInit, OnDestroy {
  data = input.required<FlameNode>();
  valueUnit = input<'samples' | 'bytes'>('samples');

  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  protected searchTerm = '';
  private chart?: FlameGraphChart;

  constructor() {
    effect(() => {
      const data = this.data();
      if (this.chart) {
        this.chart.update(data as never);
      }
    });
  }

  ngAfterViewInit(): void {
    const width = this.containerRef.nativeElement.clientWidth || 800;
    this.chart = flamegraph()
      .width(width)
      .cellHeight(20)
      .transitionDuration(250)
      .minFrameSize(1)
      .setLabelHandler((node: FlameGraphHierarchyNode) => `${node.data.name} — ${formatValue(node.data.value, this.valueUnit())}`);

    d3.select(this.containerRef.nativeElement).datum(this.data() as never).call(this.chart as never);
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.chart) return;
    const width = this.containerRef.nativeElement.clientWidth;
    if (width > 0) {
      this.chart.width(width);
      this.chart.update();
    }
  }

  protected onSearch(term: string): void {
    if (term) this.chart?.search(term);
    else this.chart?.clear();
  }

  protected onResetZoom(): void {
    this.chart?.resetZoom();
  }

  protected formatTotal(): string {
    return formatValue(this.data().value, this.valueUnit());
  }
}
