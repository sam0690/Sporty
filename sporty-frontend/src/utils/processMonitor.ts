export interface ProcessSnapshot {
  label: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
}

export function startProcess(label: string): ProcessSnapshot {
  return {
    label,
    startedAt: performance.now(),
  };
}

export function endProcess(snapshot: ProcessSnapshot): ProcessSnapshot {
  const endedAt = performance.now();
  return {
    ...snapshot,
    endedAt,
    durationMs: Math.max(0, endedAt - snapshot.startedAt),
  };
}
