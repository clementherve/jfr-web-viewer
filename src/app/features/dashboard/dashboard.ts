import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RecordingStateService } from '../../core/jfr/recording-state.service';
import type { ParsedRecording } from '../../core/jfr/models';
import { FlameGraphComponent } from '../flamegraph/flame-graph';
import { AllocationsPanelComponent } from './allocations-panel';
import { EventsBrowserPanelComponent } from './events-browser-panel';
import { ExceptionsPanelComponent } from './exceptions-panel';
import { GcPanelComponent } from './gc-panel';
import { OverviewPanelComponent } from './overview-panel';
import { ThreadsPanelComponent } from './threads-panel';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    OverviewPanelComponent,
    FlameGraphComponent,
    AllocationsPanelComponent,
    GcPanelComponent,
    ThreadsPanelComponent,
    ExceptionsPanelComponent,
    EventsBrowserPanelComponent,
  ],
  template: `
    <div class="dashboard-header">
      <h2>{{ recording().fileName }}</h2>
      <button mat-stroked-button (click)="close()">
        <mat-icon>close</mat-icon>
        Close
      </button>
    </div>

    <mat-tab-group animationDuration="150ms">
      <mat-tab label="Overview">
        <ng-template matTabContent>
          <app-overview-panel [recording]="recording()" />
        </ng-template>
      </mat-tab>
      <mat-tab label="CPU Flame Graph">
        <ng-template matTabContent>
          <app-flame-graph [data]="recording().cpuFlameGraph" valueUnit="samples" />
        </ng-template>
      </mat-tab>
      <mat-tab label="Allocations">
        <ng-template matTabContent>
          <app-allocations-panel [recording]="recording()" />
        </ng-template>
      </mat-tab>
      <mat-tab label="Garbage Collection">
        <ng-template matTabContent>
          <app-gc-panel [recording]="recording()" />
        </ng-template>
      </mat-tab>
      <mat-tab label="Threads">
        <ng-template matTabContent>
          <app-threads-panel [recording]="recording()" />
        </ng-template>
      </mat-tab>
      <mat-tab label="Exceptions">
        <ng-template matTabContent>
          <app-exceptions-panel [recording]="recording()" />
        </ng-template>
      </mat-tab>
      <mat-tab label="Raw Events">
        <ng-template matTabContent>
          <app-events-browser-panel [recording]="recording()" />
        </ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [
    `
      .dashboard-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .dashboard-header h2 {
        margin: 0;
        overflow-wrap: anywhere;
      }
      mat-tab-group {
        display: block;
      }
      ::ng-deep .mat-mdc-tab-body-content {
        padding: 20px 4px;
      }
    `,
  ],
})
export class DashboardComponent {
  recording = input.required<ParsedRecording>();
  private readonly stateService = inject(RecordingStateService);

  protected close(): void {
    this.stateService.clear();
  }
}
