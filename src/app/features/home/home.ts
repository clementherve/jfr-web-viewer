import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RecordingStateService } from '../../core/jfr/recording-state.service';
import { DashboardComponent } from '../dashboard/dashboard';
import { HistoryListComponent } from '../history/history-list';
import { UploadComponent } from '../upload/upload';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, UploadComponent, HistoryListComponent, DashboardComponent],
  template: `
    @if (stateService.recording(); as recording) {
      <app-dashboard [recording]="recording" />
    } @else {
      <div class="workbench">
        <h1>JFR Viewer</h1>
        <p class="tagline">Explore Java Flight Recorder profiles entirely in your browser.</p>

        @if (stateService.error(); as error) {
          <div class="error-banner">
            <mat-icon>error_outline</mat-icon>
            <span>{{ error }}</span>
            <button mat-icon-button (click)="dismissError()"><mat-icon>close</mat-icon></button>
          </div>
        }

        @if (stateService.loading()) {
          <div class="loading-panel">
            <p>{{ stateService.progress()?.stage || 'Parsing…' }}</p>
            <mat-progress-bar [mode]="stateService.progress()?.percent != null ? 'determinate' : 'indeterminate'" [value]="stateService.progress()?.percent ?? 0" />
          </div>
        } @else {
          <app-upload (fileSelected)="onFile($event)" />
        }

        <h2 class="section-title">Previous recordings</h2>
        <app-history-list />
      </div>
    }
  `,
  styles: [
    `
      .workbench {
        max-width: 760px;
        margin: 0 auto;
        padding: 32px 16px 64px;
      }
      h1 {
        margin-bottom: 4px;
      }
      .tagline {
        color: var(--mat-sys-on-surface-variant);
        margin-top: 0;
        margin-bottom: 24px;
      }
      .section-title {
        margin-top: 40px;
      }
      .error-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 8px;
        background-color: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
        margin-bottom: 16px;
      }
      .error-banner span {
        flex: 1;
      }
      .loading-panel {
        padding: 24px;
        text-align: center;
      }
    `,
  ],
})
export class HomeComponent {
  protected readonly stateService = inject(RecordingStateService);

  protected onFile(file: File): void {
    void this.stateService.loadFile(file);
  }

  protected dismissError(): void {
    this.stateService.error.set(null);
  }
}
