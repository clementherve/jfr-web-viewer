import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createResolver } from './resolver';
import { parseJfrFile } from './jfr-parser';
import type { DecodedValue } from './jfr-types';

/**
 * Validates the hand-written JFR parser against a real recording produced by
 * `java -XX:StartFlightRecording=settings=profile ...` and cross-checked with
 * the JDK's own `jfr summary` / `jfr print` CLI tools (ground truth captured
 * separately; expected counts below are transcribed from that output).
 */
function loadFixtureBuffer(): ArrayBuffer {
  const path = join(__dirname, 'test-fixtures', 'sample.jfr');
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function asRecord(value: DecodedValue): Record<string, DecodedValue> {
  return value as Record<string, DecodedValue>;
}

describe('parseJfrFile against real fixture', () => {
  const buffer = loadFixtureBuffer();
  const parsed = parseJfrFile(buffer);

  it('parses exactly one chunk', () => {
    expect(parsed.chunks.length).toBe(1);
  });

  const chunk = parsed.chunks[0];
  const resolve = createResolver(chunk.pools);

  function countByType(typeName: string): number {
    return chunk.events.filter((e) => e.typeName === typeName).length;
  }

  it('matches ground-truth event counts from `jfr summary`', () => {
    expect(countByType('jdk.ExecutionSample')).toBe(2128);
    expect(countByType('jdk.ObjectAllocationSample')).toBe(2116);
    expect(countByType('jdk.GCHeapSummary')).toBe(236);
    expect(countByType('jdk.GarbageCollection')).toBe(118);
    expect(countByType('jdk.ThreadStart')).toBe(9);
    expect(countByType('jdk.CPULoad')).toBe(5);
    expect(countByType('jdk.ThreadCPULoad')).toBe(5);
    expect(countByType('jdk.ThreadPark')).toBe(1);
    expect(countByType('jdk.JavaMonitorEnter')).toBe(0);
  });

  it('resolves JVMInformation fields matching the real recording', () => {
    const jvmInfo = asRecord(resolve(asRecord(chunk.events.find((e) => e.typeName === 'jdk.JVMInformation')!.fields) as unknown as DecodedValue));
    expect(jvmInfo['jvmName']).toBe('OpenJDK 64-Bit Server VM');
    expect(String(jvmInfo['jvmVersion'])).toContain('25.0.2');
    expect(jvmInfo['pid']).toBe(56164n);
  });

  it('resolves OSInformation matching the real host', () => {
    const osInfo = asRecord(resolve(asRecord(chunk.events.find((e) => e.typeName === 'jdk.OSInformation')!.fields) as unknown as DecodedValue));
    expect(String(osInfo['osVersion'])).toContain('Darwin');
  });

  it('resolves CPULoad percentages into a sane 0..1 range', () => {
    const cpuEvents = chunk.events.filter((e) => e.typeName === 'jdk.CPULoad');
    for (const ev of cpuEvents) {
      const resolved = asRecord(resolve(ev.fields as unknown as DecodedValue));
      const user = resolved['jvmUser'] as number;
      const machine = resolved['machineTotal'] as number;
      expect(user).toBeGreaterThan(0);
      expect(user).toBeLessThan(1);
      expect(machine).toBeGreaterThan(0);
      expect(machine).toBeLessThan(1);
    }
  });

  it('resolves ExecutionSample stack traces down to real method names', () => {
    const sample = chunk.events.find((e) => e.typeName === 'jdk.ExecutionSample')!;
    const resolved = asRecord(resolve(sample.fields as unknown as DecodedValue));

    const thread = asRecord(resolved['sampledThread'] as DecodedValue);
    expect(String(thread['javaName'])).toMatch(/pool-1-thread-\d/);

    const stackTrace = asRecord(resolved['stackTrace'] as DecodedValue);
    const frames = stackTrace['frames'] as DecodedValue[];
    expect(frames.length).toBeGreaterThan(0);

    const topFrame = asRecord(frames[0]);
    const method = asRecord(topFrame['method'] as DecodedValue);
    const methodName = asRecord(method['name'] as DecodedValue)['string'];
    const klass = asRecord(method['type'] as DecodedValue);
    const className = asRecord(klass['name'] as DecodedValue)['string'];

    // Every sample in this fixture is deep inside Sample.fib(int).
    expect(className).toBe('Sample');
    expect(methodName).toBe('fib');
  });

  it('resolves ObjectAllocationSample with a real class name and positive weight', () => {
    const alloc = chunk.events.find((e) => e.typeName === 'jdk.ObjectAllocationSample')!;
    const resolved = asRecord(resolve(alloc.fields as unknown as DecodedValue));
    const objectClass = asRecord(resolved['objectClass'] as DecodedValue);
    const className = asRecord(objectClass['name'] as DecodedValue)['string'];
    expect(typeof className).toBe('string');
    expect((className as string).length).toBeGreaterThan(0);

    const weight = resolved['weight'];
    expect(typeof weight === 'number' || typeof weight === 'bigint').toBe(true);
  });

  it('shares identical stack traces via the constant pool (memoized resolution)', () => {
    const samples = chunk.events.filter((e) => e.typeName === 'jdk.ExecutionSample');
    // At least two distinct raw ConstantRef field values should point at the
    // same underlying stack trace pool entry for a tight, repeatedly-sampled loop.
    const refs = samples.map((s) => (s.fields as unknown as Record<string, DecodedValue>)['stackTrace']);
    const seen = new Set(refs.map((r) => JSON.stringify(r)));
    expect(seen.size).toBeLessThan(refs.length);
  });
});
