export interface StoredRecordingSummary {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedAtMs: number;
  durationMs: number;
  startTimeMs: number;
  jvmVersion: string | null;
  eventCount: number;
}
