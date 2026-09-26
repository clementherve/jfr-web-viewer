export interface RecordingMetadata {
  jvmName: string | null;
  jvmVersion: string | null;
  jvmArguments: string | null;
  javaArguments: string | null;
  pid: string | null;
  osVersion: string | null;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
}

export interface CpuLoadSample {
  timeMs: number;
  jvmUser: number;
  jvmSystem: number;
  machineTotal: number;
}

export interface ThreadCpuSample {
  timeMs: number;
  threadName: string;
  jvmUser: number;
  jvmSystem: number;
}

export interface HeapSample {
  timeMs: number;
  heapUsedBytes: number;
  heapCommittedBytes: number;
  when: string;
  gcId: number;
}

export interface GcPauseEvent {
  timeMs: number;
  durationMs: number;
  gcId: number;
  name: string;
  cause: string;
}

export interface ThreadLifecycleEvent {
  timeMs: number;
  kind: 'start' | 'end';
  threadName: string;
  javaThreadId: number;
}

export interface ExceptionEvent {
  timeMs: number;
  thrownClass: string;
  message: string | null;
}

export interface FlameNode {
  name: string;
  value: number;
  children: FlameNode[];
}

export interface EventTypeSummary {
  typeName: string;
  count: number;
}

/** A single row of a fully-resolved, JSON-safe event, for the generic event browser. */
export interface RawEventRow {
  timeMs: number | null;
  offset: number;
  fields: Record<string, unknown>;
}

export interface ParsedRecording {
  fileName: string;
  fileSizeBytes: number;
  metadata: RecordingMetadata;
  cpuLoad: CpuLoadSample[];
  threadCpu: ThreadCpuSample[];
  heap: HeapSample[];
  gcPauses: GcPauseEvent[];
  threadLifecycle: ThreadLifecycleEvent[];
  exceptions: ExceptionEvent[];
  cpuFlameGraph: FlameNode;
  allocationFlameGraph: FlameNode;
  eventTypeSummary: EventTypeSummary[];
}
