import type { ChunkHeader } from './jfr-types';

/**
 * Converts a raw `Timestamp(TICKS)` field value into epoch milliseconds,
 * using the chunk header's start-time/tick calibration (see JFR format §7).
 */
export function ticksToEpochMs(ticks: bigint, header: ChunkHeader): number {
  const deltaTicks = ticks - header.startTicks;
  const deltaNanos = (deltaTicks * 1_000_000_000n) / header.ticksPerSecond;
  const epochNanos = header.startTimeNanos + deltaNanos;
  return Number(epochNanos / 1_000_000n);
}

/** Converts a raw `Timespan(TICKS)` field value (e.g. a duration) into milliseconds. */
export function ticksToDurationMs(ticks: bigint, header: ChunkHeader): number {
  const nanos = (ticks * 1_000_000_000n) / header.ticksPerSecond;
  return Number(nanos) / 1e6;
}
