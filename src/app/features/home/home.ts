import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RecordingStateService } from '../../core/jfr/recording-state.service';
import { TopBarComponent } from '../../shared/top-bar';
import { DashboardComponent } from '../dashboard/dashboard';
import { HistoryListComponent } from '../history/history-list';
import { UploadComponent } from '../upload/upload';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, TopBarComponent, UploadComponent, HistoryListComponent, DashboardComponent],
  template: `
    @if (stateService.recording(); as recording) {
      <app-dashboard [recording]="recording" />
    } @else {
      <app-top-bar [recording]="stateService.loading()">
        <span class="privacy"><mat-icon>lock</mat-icon>Files are parsed in your browser and never uploaded</span>
      </app-top-bar>

      <main class="home">
        <section class="open" aria-labelledby="open-title">
          <h1 id="open-title">Open a flight recording</h1>
          <p class="lede">See where CPU time and memory go, how long GC paused your app, and which exceptions it threw.</p>

          @if (stateService.error(); as error) {
            <div class="error-banner" role="alert">
              <mat-icon>error</mat-icon>
              <div>
                <strong>This file couldn't be opened</strong>
                <span>{{ error }}</span>
              </div>
              <button mat-icon-button aria-label="Dismiss" (click)="dismissError()"><mat-icon>close</mat-icon></button>
            </div>
          }

          @if (stateService.loading()) {
            <div class="loading-panel" aria-live="polite">
              <p class="stage">{{ stateService.progress()?.stage || 'Reading recording…' }}</p>
              <mat-progress-bar
                [mode]="stateService.progress()?.percent != null ? 'determinate' : 'indeterminate'"
                [value]="stateService.progress()?.percent ?? 0"
              />
              @if (stateService.progress()?.percent != null) {
                <p class="hint num">{{ stateService.progress()!.percent!.toFixed(0) }}%</p>
              }
            </div>
          } @else {
            <app-upload (fileSelected)="onFile($event)" />
          }

          <details class="howto">
            <summary>How do I make a .jfr file?</summary>
            <p>Start a recording on a running JVM with <code class="code">jcmd</code>:</p>
            <pre class="code">jcmd &lt;pid&gt; JFR.start duration=60s settings=profile filename=app.jfr</pre>
            <p>Or launch with <code class="code">-XX:StartFlightRecording=duration=60s,filename=app.jfr</code>. The <code class="code">profile</code> settings also capture allocations.</p>
          </details>
        </section>

        <section class="recent" aria-labelledby="recent-title">
          <h2 id="recent-title">Recent recordings</h2>
          <app-history-list />
        </section>
      </main>
    }
  `,
  styles: [
    `
      .privacy {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--muted);
      }
      .privacy mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
      .home {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
        gap: 48px;
        max-width: 1160px;
        margin: 0 auto;
        padding: 56px 24px 80px;
      }
      h1 {
        font-size: 36px;
        letter-spacing: -0.025em;
        margin: 0 0 12px;
      }
      .lede {
        font-size: 16px;
        color: var(--muted);
        max-width: 52ch;
        margin: 0 0 28px;
      }
      h2 {
        font-size: 15px;
        margin: 10px 0 16px;
      }
      .error-banner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 8px 12px 14px;
        border-radius: var(--radius-m);
        background: var(--danger-wash);
        color: var(--danger-ink);
        margin-bottom: 16px;
      }
      .error-banner > mat-icon {
        margin-top: 2px;
      }
      .error-banner div {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow-wrap: anywhere;
      }
      .loading-panel {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 12px;
        min-height: 280px;
        padding: 0 48px;
        box-sizing: border-box;
        background: var(--panel);
        border: 1px solid var(--rule);
        border-radius: 14px;
      }
      .stage {
        margin: 0;
        font-weight: 500;
      }
      .loading-panel .hint {
        margin: 0;
      }
      .howto {
        margin-top: 24px;
        color: var(--muted);
        max-width: 64ch;
      }
      .howto summary {
        cursor: pointer;
        color: var(--ink);
        font-weight: 500;
      }
      .howto pre {
        background: var(--panel);
        border: 1px solid var(--rule);
        border-radius: var(--radius-s);
        padding: 10px 12px;
        overflow-x: auto;
        color: var(--ink);
      }
      .howto code {
        color: var(--ink);
      }
      @media (max-width: 860px) {
        .home {
          grid-template-columns: minmax(0, 1fr);
          gap: 40px;
          padding: 32px 16px 64px;
        }
        h1 {
          font-size: 28px;
        }
        .privacy {
          display: none;
        }
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
