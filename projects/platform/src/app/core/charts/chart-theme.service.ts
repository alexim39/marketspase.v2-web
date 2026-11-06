import { computed, inject, Injectable } from '@angular/core';
import { ThemeTogglerService } from '../../_common/services/theme-toggler.service';
import type { EChartsCoreOption } from './echarts-setup';

export interface DpChartPalette {
  text: string;
  muted: string;
  line: string;
  gold: string;
  goldSoft: string;
  success: string;
  error: string;
  info: string;
  ramp: string[];
}

/**
 * Chart theming bound to the MarketSpase theme signal — options built in a
 * `computed()` re-render automatically on light/dark toggle.
 */
@Injectable({ providedIn: 'root' })
export class ChartThemeService {
  private readonly themes = inject(ThemeTogglerService);

  readonly palette = computed<DpChartPalette>(() => {
    const dark = this.themes.theme() === 'dark';
    return {
      text: dark ? '#f5f3ff' : '#111827',
      muted: dark ? '#b9b3c9' : '#6b7280',
      line: dark ? '#332d4a' : '#e5e7eb',
      gold: '#667eea',
      goldSoft: dark ? '#2a2545' : '#eef0fd',
      success: dark ? '#6ee7b7' : '#047857',
      error: dark ? '#fca5a5' : '#b91c1c',
      info: dark ? '#93c5fd' : '#1d4ed8',
      ramp: ['#667eea', '#a0adf3', '#8192ee', '#4a5bc4', '#5a6fd8', '#fcd34d'],
    };
  });

  /** Base text/line colors shared by every chart. */
  base(): EChartsCoreOption {
    const p = this.palette();
    return {
      backgroundColor: 'transparent',
      textStyle: { color: p.text, fontFamily: 'Inter, Roboto, Arial, sans-serif' },
      animationDuration: 400,
    };
  }

  axis(): { axisLine: object; axisLabel: object; splitLine: object } {
    const p = this.palette();
    return {
      axisLine: { lineStyle: { color: p.line } },
      axisLabel: { color: p.muted },
      splitLine: { lineStyle: { color: p.line, opacity: 0.6 } },
    };
  }
}
