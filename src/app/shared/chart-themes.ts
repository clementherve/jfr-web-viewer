/**
 * ECharts themes matching the CSS tokens in styles.scss. ECharts draws to canvas
 * and can't read CSS variables, so the values are duplicated here.
 */

interface Palette {
  ink: string;
  muted: string;
  rule: string;
  panel: string;
  series: string[];
}

const light: Palette = {
  ink: '#161b24',
  muted: '#5a6371',
  rule: '#dce0e6',
  panel: '#ffffff',
  series: ['#d4440a', '#3d6fb6', '#1f8f7c', '#8e5bb5', '#a07a12', '#6b7380'],
};

const dark: Palette = {
  ink: '#e7eaef',
  muted: '#97a0ae',
  rule: '#29303b',
  panel: '#171c24',
  series: ['#ff6b2c', '#6f9ce0', '#3fbfa7', '#b48ae0', '#d9ab3a', '#9aa3b2'],
};

function buildTheme(p: Palette): object {
  const axis = {
    axisLine: { lineStyle: { color: p.rule } },
    axisTick: { lineStyle: { color: p.rule } },
    axisLabel: { color: p.muted },
    splitLine: { lineStyle: { color: p.rule, type: 'dashed' } },
    nameTextStyle: { color: p.muted },
  };
  return {
    color: p.series,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Instrument Sans, system-ui, sans-serif', color: p.ink },
    legend: { textStyle: { color: p.muted }, icon: 'roundRect', itemWidth: 12, itemHeight: 4 },
    tooltip: {
      backgroundColor: p.panel,
      borderColor: p.rule,
      textStyle: { color: p.ink, fontSize: 12 },
      axisPointer: { lineStyle: { color: p.muted }, crossStyle: { color: p.muted } },
    },
    timeAxis: axis,
    valueAxis: axis,
    categoryAxis: { ...axis, axisLabel: { color: p.ink, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11 } },
    line: { lineStyle: { width: 1.5 }, symbol: 'none' },
    bar: { itemStyle: { borderRadius: [0, 3, 3, 0] } },
    dataZoom: {
      borderColor: p.rule,
      fillerColor: 'rgba(212, 68, 10, 0.12)',
      handleStyle: { color: p.panel, borderColor: p.muted },
      moveHandleStyle: { color: p.rule },
      textStyle: { color: p.muted },
      dataBackground: { lineStyle: { color: p.muted }, areaStyle: { color: p.rule } },
    },
  };
}

export function registerChartThemes(echarts: { registerTheme(name: string, theme: object): void }): void {
  echarts.registerTheme('jfr-light', buildTheme(light));
  echarts.registerTheme('jfr-dark', buildTheme(dark));
}
