import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RecordingStateService } from '../../core/jfr/recording-state.service';
import type { ParsedRecording } from '../../core/jfr/models';
import { formatBytes, formatCompact, formatDuration } from '../../shared/formatters';
import { TopBarComponent } from '../../shared/top-bar';
import { FlameGraphComponent } from '../flamegraph/flame-graph';
import { AllocationsPanelComponent } from './allocations-panel';
import { EventsBrowserPanelComponent } from './events-browser-panel';
import { ExceptionsPanelComponent } from './exceptions-panel';
import { GcPanelComponent } from './gc-panel';
import { OverviewPanelComponent } from './overview-panel';
import { ThreadsPanelComponent } from './threads-panel';

type SectionId = 'overview' | 'cpu' | 'allocations' | 'gc' | 'threads' | 'exceptions' | 'events';

interface Section {
  id: SectionId;
  label: string;
  icon: string;
  /** Short count shown in the sidebar; null when the section has no data. */
  count: string | null;
  countLabel?: string;
  description: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TopBarComponent,
    OverviewPanelComponent,
    FlameGraphComponent,
    AllocationsPanelComponent,
    GcPanelComponent,
    ThreadsPanelComponent,
    ExceptionsPanelComponent,
    EventsBrowserPanelComponent,
  ],
  template: `
    <app-top-bar>
      <div class="recording-id">
        <span class="file-name" [matTooltip]="recording().fileName">{{ recording().fileName }}</span>
        <span class="facts">
          @if (recording().metadata.jvmVersion) {
            <span>{{ shortJvm() }}</span>
          }
          <span class="num">{{ formatDuration(recording().metadata.durationMs) }}</span>
          <span class="num">{{ formatBytes(recording().fileSizeBytes) }}</span>
        </span>
      </div>
      <ng-container barActions>
        <button mat-stroked-button (click)="fileInput.click()">
          <mat-icon>folder_open</mat-icon>
          <span class="action-label">Open another</span>
        </button>
        <button mat-icon-button matTooltip="Close recording" aria-label="Close recording" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </ng-container>
    </app-top-bar>
    <input #fileInput type="file" accept=".jfr" hidden (change)="onFileInputChange($event)" />

    <div class="layout">
      <nav class="sections" aria-label="Recording sections">
        @for (section of sections(); track section.id) {
          <button
            type="button"
            class="section-link"
            [class.active]="active() === section.id"
            [class.no-data]="section.count === null"
            [attr.aria-current]="active() === section.id ? 'page' : null"
            (click)="select(section.id)"
          >
            <mat-icon aria-hidden="true">{{ section.icon }}</mat-icon>
            <span class="section-label">{{ section.label }}</span>
            @if (section.count !== null) {
              <span class="count num" [attr.aria-label]="section.count + ' ' + section.countLabel">{{ section.count }}</span>
            } @else if (section.id !== 'overview') {
              <span class="count">none</span>
            }
          </button>
        }
      </nav>

      <main class="panel">
        <header class="panel-header">
          <h1>{{ activeSection().label }}</h1>
          <p class="hint">{{ activeSection().description }}</p>
        </header>

        @switch (active()) {
          @case ('overview') {
            <app-overview-panel [recording]="recording()" />
          }
          @case ('cpu') {
            @if (recording().cpuFlameGraph.value === 0) {
              <div class="empty-state">
                <strong>No CPU samples in this recording</strong>
                Execution sampling (jdk.ExecutionSample) was off. Record with <code class="code">settings=profile</code> to capture it.
              </div>
            } @else {
              <app-flame-graph [data]="recording().cpuFlameGraph" valueUnit="samples" />
            }
          }
          @case ('allocations') {
            <app-allocations-panel [recording]="recording()" />
          }
          @case ('gc') {
            <app-gc-panel [recording]="recording()" />
          }
          @case ('threads') {
            <app-threads-panel [recording]="recording()" />
          }
          @case ('exceptions') {
            <app-exceptions-panel [recording]="recording()" />
          }
          @case ('events') {
            <app-events-browser-panel [recording]="recording()" />
          }
        }
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
      .recording-id {
        display: flex;
        align-items: baseline;
        gap: 16px;
        min-width: 0;
        padding-left: 20px;
        border-left: 1px solid var(--rule);
      }
      .file-name {
        font-family: var(--font-code);
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .facts {
        display: flex;
        gap: 14px;
        font-size: 13px;
        color: var(--muted);
        white-space: nowrap;
      }
      .layout {
        flex: 1;
        display: grid;
        grid-template-columns: 232px minmax(0, 1fr);
      }
      .sections {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 20px 12px;
        border-right: 1px solid var(--rule);
        position: sticky;
        top: 0;
        align-self: start;
      }
      .section-link {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 12px;
        border: 0;
        border-radius: var(--radius-s);
        background: none;
        color: var(--ink);
        font: inherit;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
        white-space: nowrap;
      }
      .section-link mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--muted);
      }
      .section-link:hover {
        background: var(--hover);
      }
      .section-link.active {
        background: var(--signal-wash);
        color: var(--signal-ink);
      }
      .section-link.active mat-icon {
        color: var(--signal);
      }
      .section-link.no-data:not(.active) .section-label {
        color: var(--muted);
      }
      .section-label {
        flex: 1;
      }
      .count {
        font-size: 12px;
        font-weight: 500;
        color: var(--muted);
      }
      .panel {
        padding: 28px 32px 64px;
        min-width: 0;
      }
      .panel-header {
        margin-bottom: 24px;
      }
      .panel-header h1 {
        font-size: 24px;
        letter-spacing: -0.02em;
        margin: 0 0 4px;
      }
      .panel-header .hint {
        margin: 0;
        max-width: 72ch;
      }
      @media (max-width: 900px) {
        .facts {
          display: none;
        }
        .action-label {
          display: none;
        }
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
        .sections {
          flex-direction: row;
          overflow-x: auto;
          padding: 8px 12px;
          border-right: 0;
          border-bottom: 1px solid var(--rule);
          position: static;
        }
        .section-link {
          gap: 8px;
          padding: 7px 10px;
        }
        .panel {
          padding: 20px 16px 48px;
        }
      }
      @media (max-width: 600px) {
        .recording-id {
          padding-left: 12px;
        }
      }
    `,
  ],
})
export class DashboardComponent {
  recording = input.required<ParsedRecording>();
  protected readonly stateService = inject(RecordingStateService);

  protected readonly active = signal<SectionId>('overview');
  protected formatDuration = formatDuration;
  protected formatBytes = formatBytes;

  protected shortJvm = computed(() => {
    // "Java HotSpot(TM) 64-Bit Server VM (21.0.2+13-LTS-58) for bsd-aarch64 JRE ..." -> "21.0.2+13-LTS-58"
    const version = this.recording().metadata.jvmVersion ?? '';
    const match = version.match(/\(([^)]+)\)/);
    return match ? `JDK ${match[1]}` : version;
  });

  protected sections = computed<Section[]>(() => {
    const r = this.recording();
    const count = (n: number) => (n > 0 ? formatCompact(n) : null);
    const threadsStarted = r.threadLifecycle.filter((e) => e.kind === 'start').length;
    return [
      { id: 'overview', label: 'Overview', icon: 'dashboard', count: null, description: 'The JVM that was recorded, and how its CPU and heap behaved over time.' },
      {
        id: 'cpu',
        label: 'CPU',
        icon: 'local_fire_department',
        count: count(r.cpuFlameGraph.value),
        countLabel: 'samples',
        description: 'Where threads spent CPU time. Wider frames ran more often. Click a frame to zoom into it.',
      },
      {
        id: 'allocations',
        label: 'Allocations',
        icon: 'memory',
        count: r.allocationFlameGraph.value > 0 ? formatBytes(r.allocationFlameGraph.value) : null,
        countLabel: 'sampled',
        description: 'Which classes and call paths allocated the most memory, weighted by sampled size.',
      },
      {
        id: 'gc',
        label: 'Garbage collection',
        icon: 'recycling',
        count: count(r.gcPauses.length),
        countLabel: 'pauses',
        description: 'Every stop-the-world pause the collector made, and what caused it.',
      },
      {
        id: 'threads',
        label: 'Threads',
        icon: 'account_tree',
        count: count(threadsStarted),
        countLabel: 'started',
        description: 'How many threads were alive over time, and when each one started or ended.',
      },
      {
        id: 'exceptions',
        label: 'Exceptions',
        icon: 'report',
        count: count(r.exceptions.length),
        countLabel: 'thrown',
        description: 'Exceptions thrown while recording, grouped by class. Frequent throws are a common hidden cost.',
      },
      {
        id: 'events',
        label: 'All events',
        icon: 'table_rows',
        count: count(r.eventTypeSummary.length),
        countLabel: 'event types',
        description: 'Browse any event type in the recording, field by field.',
      },
    ];
  });

  protected activeSection = computed(() => this.sections().find((s) => s.id === this.active())!);

  protected select(id: SectionId): void {
    this.active.set(id);
    window.scrollTo({ top: 0 });
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    // The parser worker backs this dashboard's event browser, so leave it before parsing the next file.
    this.stateService.clear();
    void this.stateService.loadFile(file);
  }

  protected close(): void {
    this.stateService.clear();
  }
}
