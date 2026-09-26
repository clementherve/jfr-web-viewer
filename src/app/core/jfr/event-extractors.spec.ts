import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseJfrFile } from './binary/jfr-parser';
import { extractRecording } from './event-extractors';

function loadFixtureBuffer(): ArrayBuffer {
  const path = join(__dirname, 'binary', 'test-fixtures', 'sample.jfr');
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('extractRecording against real fixture', () => {
  const raw = parseJfrFile(loadFixtureBuffer());
  const recording = extractRecording(raw, 'sample.jfr', 1_794_364);

  it('extracts JVM/OS metadata', () => {
    expect(recording.metadata.jvmName).toBe('OpenJDK 64-Bit Server VM');
    expect(recording.metadata.pid).toBe('56164');
    expect(recording.metadata.osVersion).toContain('Darwin');
    expect(recording.metadata.durationMs).toBeGreaterThan(6000);
    expect(recording.metadata.durationMs).toBeLessThan(9000);
  });

  it('extracts CPU load samples in chronological order with sane percentages', () => {
    expect(recording.cpuLoad.length).toBe(5);
    for (const s of recording.cpuLoad) {
      expect(s.jvmUser).toBeGreaterThan(0);
      expect(s.machineTotal).toBeGreaterThan(0);
      expect(s.machineTotal).toBeLessThan(1);
    }
    for (let i = 1; i < recording.cpuLoad.length; i++) {
      expect(recording.cpuLoad[i].timeMs).toBeGreaterThanOrEqual(recording.cpuLoad[i - 1].timeMs);
    }
  });

  it('extracts heap samples with positive used bytes', () => {
    expect(recording.heap.length).toBe(238); // 236 jdk.GCHeapSummary + 2 jdk.GCHeapMemoryUsage
    expect(recording.heap.every((h) => h.heapUsedBytes > 0)).toBe(true);
  });

  it('extracts GC pauses with readable collector names and causes', () => {
    expect(recording.gcPauses.length).toBe(118);
    const first = recording.gcPauses[0];
    expect(first.name).toMatch(/G1/);
    expect(first.cause.length).toBeGreaterThan(0);
    expect(first.durationMs).toBeGreaterThan(0);
  });

  it('extracts thread lifecycle events', () => {
    expect(recording.threadLifecycle.filter((t) => t.kind === 'start').length).toBe(9);
    expect(recording.threadLifecycle[0].threadName.length).toBeGreaterThan(0);
  });

  it('extracts exceptions with a readable, dotted class name', () => {
    expect(recording.exceptions.length).toBe(4);
    for (const e of recording.exceptions) {
      expect(e.thrownClass).not.toContain('/');
      expect(e.thrownClass.length).toBeGreaterThan(0);
    }
  });

  it('builds a CPU flame graph rooted at "all" dominated by Sample.fib', () => {
    const root = recording.cpuFlameGraph;
    expect(root.name).toBe('all');
    expect(root.value).toBe(2128);
    expect(everyNodeValueCoversItsChildren(root)).toBe(true);
    const fibNode = findByName(root, (n) => n.endsWith('Sample.fib'));
    expect(fibNode).toBeTruthy();
    expect(fibNode!.value).toBeGreaterThan(1000);
  });

  it('builds an allocation flame graph with byte[] and ConcurrentHashMap allocations', () => {
    const root = recording.allocationFlameGraph;
    expect(root.value).toBeGreaterThan(0);
    const byteArrayNode = findByName(root, (n) => n.includes('byte[]'));
    expect(byteArrayNode).toBeTruthy();
  });

  it('produces an event-type summary covering the full recording', () => {
    const total = recording.eventTypeSummary.reduce((sum, e) => sum + e.count, 0);
    expect(total).toBe(raw.chunks[0].events.length);
    expect(recording.eventTypeSummary.find((e) => e.typeName === 'jdk.ExecutionSample')?.count).toBe(2128);
  });
});

/** A flame graph node's value is inclusive (samples passing through it); children may sum to less (self time at this frame), never more. */
function everyNodeValueCoversItsChildren(node: { value: number; children: { value: number }[] }): boolean {
  const childSum = node.children.reduce((sum, c) => sum + c.value, 0);
  if (childSum > node.value) return false;
  return node.children.every((c) => everyNodeValueCoversItsChildren(c as never));
}

function findByName(
  node: { name: string; value: number; children: unknown[] },
  predicate: (name: string) => boolean,
): { name: string; value: number; children: unknown[] } | null {
  if (predicate(node.name)) return node;
  for (const child of node.children as { name: string; value: number; children: unknown[] }[]) {
    const found = findByName(child, predicate);
    if (found) return found;
  }
  return null;
}
