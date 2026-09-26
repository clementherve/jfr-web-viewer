import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'jfr-viewer.theme';

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Storage can be unavailable (private mode); fall back to the OS setting.
  }
  return 'system';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly mediaQuery = this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.mediaQuery?.matches ?? false);

  readonly preference = signal<ThemePreference>(readPreference());
  readonly isDark = computed(() => (this.preference() === 'system' ? this.systemDark() : this.preference() === 'dark'));
  /** Name of the registered ECharts theme matching the current colour scheme. */
  readonly chartTheme = computed(() => (this.isDark() ? 'jfr-dark' : 'jfr-light'));

  constructor() {
    this.mediaQuery?.addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      const pref = this.preference();
      this.document.documentElement.style.colorScheme = pref === 'system' ? 'light dark' : pref;
      try {
        localStorage.setItem(STORAGE_KEY, pref);
      } catch {
        // Ignore: the preference just won't survive a reload.
      }
    });
  }

  cycle(): void {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    this.preference.update((p) => order[(order.indexOf(p) + 1) % order.length]);
  }
}
