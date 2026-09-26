import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { routes } from './app.routes';
import { registerChartThemes } from './shared/chart-themes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideEchartsCore({
      echarts: () =>
        import('echarts').then((echarts) => {
          registerChartThemes(echarts);
          return echarts;
        }),
    }),
    // index.html loads Material Symbols, not the legacy Material Icons font.
    provideAppInitializer(async () =>
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined'),
    ),
  ],
};
