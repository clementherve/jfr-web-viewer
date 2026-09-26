import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <header class="bar">
      <div class="brand" [class.recording]="recording()">
        <span class="dot" aria-hidden="true"></span>
        <span class="wordmark">JFR Viewer</span>
      </div>
      <div class="content"><ng-content /></div>
      <div class="actions">
        <ng-content select="[barActions]" />
        <button mat-icon-button (click)="theme.cycle()" [matTooltip]="themeLabel()" [attr.aria-label]="themeLabel()">
          <mat-icon>{{ themeIcon() }}</mat-icon>
        </button>
      </div>
    </header>
  `,
  styles: [
    `
      .bar {
        display: flex;
        align-items: center;
        gap: 20px;
        min-height: 56px;
        padding: 0 16px 0 20px;
        background: var(--panel);
        border-bottom: 1px solid var(--rule);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--signal);
        position: relative;
      }
      /* While a recording is being parsed the dot pulses, like a recorder's REC light. */
      .recording .dot::after {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 2px solid var(--signal);
        animation: pulse 1.2s ease-out infinite;
      }
      @keyframes pulse {
        from {
          transform: scale(0.6);
          opacity: 1;
        }
        to {
          transform: scale(1.6);
          opacity: 0;
        }
      }
      .wordmark {
        font-weight: 600;
        font-size: 15px;
        letter-spacing: -0.01em;
      }
      .content {
        flex: 1;
        min-width: 0;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      @media (max-width: 600px) {
        .bar {
          padding: 0 8px 0 16px;
          gap: 12px;
        }
        .wordmark {
          display: none;
        }
      }
    `,
  ],
})
export class TopBarComponent {
  recording = input(false);
  protected readonly theme = inject(ThemeService);

  protected themeIcon = computed(() => ({ system: 'contrast', light: 'light_mode', dark: 'dark_mode' })[this.theme.preference()]);
  protected themeLabel = computed(
    () => ({ system: 'Theme: follows system', light: 'Theme: light', dark: 'Theme: dark' })[this.theme.preference()],
  );
}
