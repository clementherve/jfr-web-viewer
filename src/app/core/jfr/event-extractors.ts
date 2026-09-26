import { createResolver } from './binary/resolver';
import { ticksToDurationMs, ticksToEpochMs } from './binary/time';
import type { ChunkHeader, DecodedValue, RawParsedFile } from './binary/jfr-types';
import type {
  CpuLoadSample,
  EventTypeSummary,
  ExceptionEvent,
  FlameNode,
  GcPauseEvent,
  HeapSample,
  ParsedRecording,
  RecordingMetadata,
  ThreadCpuSample,
  ThreadLifecycleEvent,
} from './models';

type Fields = Record<string, unknown>;

function num(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  return 0;
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

/** JVM internal class names use `/`-separated packages, and array types use descriptor syntax (e.g. "[B" for byte[]). */
const PRIMITIVE_DESCRIPTORS: Record<string, string> = {
  Z: 'boolean',
  B: 'byte',
  C: 'char',
  S: 'short',
  I: 'int',
  J: 'long',
  F: 'float',
  D: 'double',
};

function displayClassName(internal: string): string {
  if (!internal) return internal;
  if (internal[0] !== '[') return internal.replace(/\//g, '.');
  let dims = 0;
  let i = 0;
  while (internal[i] === '[') {
    dims++;
    i++;
  }
  const rest = internal.slice(i);
  let base: string;
  if (rest.startsWith('L') && rest.endsWith(';')) {
    base = rest.slice(1, -1).replace(/\//g, '.');
  } else {
    base = PRIMITIVE_DESCRIPTORS[rest] ?? rest;
  }
  return base + '[]'.repeat(dims);
}

function threadDisplayName(thread: unknown): string {
  const t = thread as Fields | null;
  if (!t) return 'unknown';
  return str(t['javaName']) || str(t['osName']) || `thread-${str(t['javaThreadId'])}`;
}

function methodDisplayName(method: unknown): string {
  const m = method as Fields | null;
  if (!m) return '(unknown)';
  const type = m['type'] as Fields | null;
  const className = type ? displayClassName(str((type['name'] as Fields | null)?.['string'])) : '';
  const methodName = str((m['name'] as Fields | null)?.['string']) || '(unknown)';
  return className ? `${className}.${methodName}` : methodName;
}

/** Root-first frame names (index 0 = outermost caller, last = leaf) for a resolved `jdk.types.StackTrace`. */
function frameNamesRootFirst(stackTrace: unknown): string[] {
  const st = stackTrace as Fields | null;
  const frames = (st?.['frames'] as unknown[] | undefined) ?? [];
  const names = frames.map((f) => methodDisplayName((f as Fields)['method']));
  return names.reverse();
}

interface FlameBuildNode {
  name: string;
  value: number;
  children: Map<string, FlameBuildNode>;
}

function buildFlameGraph(stacks: Array<{ names: string[]; weight: number }>, rootName: string): FlameNode {
  const root: FlameBuildNode = { name: rootName, value: 0, children: new Map() };
  for (const { names, weight } of stacks) {
    root.value += weight;
    let node = root;
    for (const name of names) {
      let child = node.children.get(name);
      if (!child) {
        child = { name, value: 0, children: new Map() };
        node.children.set(name, child);
      }
      child.value += weight;
      node = child;
    }
  }
  const toFlameNode = (b: FlameBuildNode): FlameNode => ({
    name: b.name,
    value: b.value,
    children: Array.from(b.children.values())
      .sort((a, c) => c.value - a.value)
      .map(toFlameNode),
  });
  return toFlameNode(root);
}

/**
 * Walks every chunk of a raw-parsed JFR file, resolving constant-pool references
 * and projecting the generic event stream into the fixed set of friendly,
 * JSON-safe structures the UI charts and tables consume.
 */
export function extractRecording(rawFile: RawParsedFile, fileName: string, fileSizeBytes: number): ParsedRecording {
  const cpuLoad: CpuLoadSample[] = [];
  const threadCpu: ThreadCpuSample[] = [];
  const heap: HeapSample[] = [];
  const gcPauses: GcPauseEvent[] = [];
  const threadLifecycle: ThreadLifecycleEvent[] = [];
  const exceptions: ExceptionEvent[] = [];
  const cpuStacks: Array<{ names: string[]; weight: number }> = [];
  const allocStacks: Array<{ names: string[]; weight: number }> = [];
  const typeCounts = new Map<string, number>();

  let jvmName: string | null = null;
  let jvmVersion: string | null = null;
  let jvmArguments: string | null = null;
  let javaArguments: string | null = null;
  let pid: string | null = null;
  let osVersion: string | null = null;
  let minStartMs = Infinity;
  let maxEndMs = -Infinity;

  for (const chunk of rawFile.chunks) {
    const header: ChunkHeader = chunk.header;
    const resolve = createResolver(chunk.pools);

    const chunkStartMs = Number(header.startTimeNanos / 1_000_000n);
    const chunkEndMs = Number((header.startTimeNanos + header.durationNanos) / 1_000_000n);
    minStartMs = Math.min(minStartMs, chunkStartMs);
    maxEndMs = Math.max(maxEndMs, chunkEndMs);

    for (const ev of chunk.events) {
      typeCounts.set(ev.typeName, (typeCounts.get(ev.typeName) ?? 0) + 1);
      const f = resolve(ev.fields as unknown as DecodedValue) as Fields;
      const startTicks = ev.fields['startTime'] as bigint | undefined;
      const timeMs = startTicks !== undefined ? ticksToEpochMs(startTicks, header) : chunkStartMs;

      switch (ev.typeName) {
        case 'jdk.JVMInformation':
          jvmName = str(f['jvmName']) || jvmName;
          jvmVersion = str(f['jvmVersion']) || jvmVersion;
          jvmArguments = str(f['jvmArguments']) || jvmArguments;
          javaArguments = str(f['javaArguments']) || javaArguments;
          pid = f['pid'] != null ? str(f['pid']) : pid;
          break;

        case 'jdk.OSInformation':
          osVersion = str(f['osVersion']) || osVersion;
          break;

        case 'jdk.CPULoad':
          cpuLoad.push({
            timeMs,
            jvmUser: num(f['jvmUser']),
            jvmSystem: num(f['jvmSystem']),
            machineTotal: num(f['machineTotal']),
          });
          break;

        case 'jdk.ThreadCPULoad':
          threadCpu.push({
            timeMs,
            threadName: threadDisplayName(f['eventThread']),
            jvmUser: num(f['user']),
            jvmSystem: num(f['system']),
          });
          break;

        case 'jdk.GCHeapSummary': {
          const heapSpace = f['heapSpace'] as Fields | undefined;
          const when = (f['when'] as Fields | undefined)?.['when'];
          heap.push({
            timeMs,
            heapUsedBytes: num(f['heapUsed']),
            heapCommittedBytes: num(heapSpace?.['committedSize']),
            when: str(when),
            gcId: num(f['gcId']),
          });
          break;
        }

        case 'jdk.GCHeapMemoryUsage':
          // Periodic heap sample independent of GC activity; the only source of heap data
          // for recordings where no collection ever ran (so jdk.GCHeapSummary never fires).
          heap.push({
            timeMs,
            heapUsedBytes: num(f['used']),
            heapCommittedBytes: num(f['committed']),
            when: '',
            gcId: -1,
          });
          break;

        case 'jdk.GarbageCollection': {
          const durationTicks = ev.fields['duration'] as bigint | undefined;
          gcPauses.push({
            timeMs,
            durationMs: durationTicks !== undefined ? ticksToDurationMs(durationTicks, header) : 0,
            gcId: num(f['gcId']),
            name: str((f['name'] as Fields | undefined)?.['name']),
            cause: str((f['cause'] as Fields | undefined)?.['cause']),
          });
          break;
        }

        case 'jdk.ThreadStart':
        case 'jdk.ThreadEnd': {
          const thread = f['thread'] ?? f['eventThread'];
          const t = thread as Fields | null;
          threadLifecycle.push({
            timeMs,
            kind: ev.typeName === 'jdk.ThreadStart' ? 'start' : 'end',
            threadName: threadDisplayName(thread),
            javaThreadId: num(t?.['javaThreadId']),
          });
          break;
        }

        case 'jdk.JavaExceptionThrow':
          exceptions.push({
            timeMs,
            thrownClass: displayClassName(nestedString(f['thrownClass'], 'name')),
            message: (f['message'] as string) || null,
          });
          break;

        case 'jdk.ExecutionSample':
        case 'jdk.NativeMethodSample':
          cpuStacks.push({ names: frameNamesRootFirst(f['stackTrace']), weight: 1 });
          break;

        case 'jdk.ObjectAllocationSample': {
          const objectClass = f['objectClass'] as Fields | undefined;
          const className = displayClassName(nestedString(objectClass, 'name'));
          const names = frameNamesRootFirst(f['stackTrace']);
          names.push(`[allocation] ${className}`);
          allocStacks.push({ names, weight: num(f['weight']) || 1 });
          break;
        }

        case 'jdk.ObjectAllocationInNewTLAB':
        case 'jdk.ObjectAllocationOutsideTLAB': {
          const objectClass = f['objectClass'] as Fields | undefined;
          const className = displayClassName(nestedString(objectClass, 'name'));
          const names = frameNamesRootFirst(f['stackTrace']);
          names.push(`[allocation] ${className}`);
          const weight = num(f['tlabSize']) || num(f['allocationSize']) || 1;
          allocStacks.push({ names, weight });
          break;
        }
      }
    }
  }

  const metadata: RecordingMetadata = {
    jvmName,
    jvmVersion,
    jvmArguments,
    javaArguments,
    pid,
    osVersion,
    startTimeMs: Number.isFinite(minStartMs) ? minStartMs : 0,
    endTimeMs: Number.isFinite(maxEndMs) ? maxEndMs : 0,
    durationMs: Number.isFinite(minStartMs) && Number.isFinite(maxEndMs) ? maxEndMs - minStartMs : 0,
  };

  const eventTypeSummary: EventTypeSummary[] = Array.from(typeCounts.entries())
    .map(([typeName, count]) => ({ typeName, count }))
    .sort((a, b) => b.count - a.count);

  cpuLoad.sort((a, b) => a.timeMs - b.timeMs);
  threadCpu.sort((a, b) => a.timeMs - b.timeMs);
  heap.sort((a, b) => a.timeMs - b.timeMs);
  gcPauses.sort((a, b) => a.timeMs - b.timeMs);
  threadLifecycle.sort((a, b) => a.timeMs - b.timeMs);
  exceptions.sort((a, b) => a.timeMs - b.timeMs);

  return {
    fileName,
    fileSizeBytes,
    metadata,
    cpuLoad,
    threadCpu,
    heap,
    gcPauses,
    threadLifecycle,
    exceptions,
    cpuFlameGraph: buildFlameGraph(cpuStacks, 'all'),
    allocationFlameGraph: buildFlameGraph(allocStacks, 'all'),
    eventTypeSummary,
  };
}

function nestedString(obj: unknown, field: string): string {
  const o = obj as Fields | null;
  const inner = o?.[field] as Fields | undefined;
  return str(inner?.['string']);
}
