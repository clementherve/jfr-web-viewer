import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, effect, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [MatButtonModule, MatIconModule, FormsModule],
  template: `
    <div class="flame-toolbar">
      <label class="search">
        <mat-icon aria-hidden="true">search</mat-icon>
        <input type="search" [(ngModel)]="searchTerm" (ngModelChange)="onSearch($event)" placeholder="Highlight frames, e.g. HashMap.get" aria-label="Highlight matching frames" />
      </label>
      <button mat-stroked-button (click)="onResetZoom()">
        <mat-icon>zoom_out_map</mat-icon>
        Reset zoom
      </button>
      <span class="total num">{{ formatTotal() }} in total</span>
    </div>
    <div class="flame-container surface" #container></div>
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
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        width: min(340px, 100%);
        height: 36px;
        padding: 0 12px;
        box-sizing: border-box;
        background: var(--panel);
        border: 1px solid var(--rule);
        border-radius: var(--radius-s);
        color: var(--muted);
      }
      .search:focus-within {
        border-color: var(--signal);
      }
      .search mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        background: none;
        color: var(--ink);
        font: inherit;
        outline: none;
      }
      .total {
        color: var(--muted);
        font-size: 13px;
        margin-left: auto;
      }
      .flame-container {
        width: 100%;
        min-height: 400px;
        overflow-x: hidden;
        padding: 8px 0;
        box-sizing: border-box;
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
