const relativeTimeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(ms: number): string {
  const diffSeconds = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return relativeTimeFormat.format(diffSeconds, 'second');
  if (abs < 3600) return relativeTimeFormat.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86400) return relativeTimeFormat.format(Math.round(diffSeconds / 3600), 'hour');
  return relativeTimeFormat.format(Math.round(diffSeconds / 86400), 'day');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

export function formatDurationMsPrecise(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function formatTimeAxisLabel(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString(undefined, { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

const compactFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export function formatCompact(n: number): string {
  return compactFormat.format(n);
}
