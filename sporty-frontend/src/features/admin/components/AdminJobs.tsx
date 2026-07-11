"use client";

import { AdminErrorState } from "./AdminErrorState";
import { useCeleryJobs, useKafkaJobs } from "@/hooks/admin/useAdminJobs";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-danger"}`}
      aria-hidden
    />
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-48 animate-pulse rounded-[3px] bg-surface-3" />
      <div className="h-4 w-64 animate-pulse rounded-[3px] bg-surface-3" />
    </div>
  );
}

export function AdminJobs() {
  const { data: celery, isLoading: celeryLoading, isError: celeryError, refetch: refetchCelery } = useCeleryJobs();
  const { data: kafka, isLoading: kafkaLoading, isError: kafkaError, refetch: refetchKafka } = useKafkaJobs();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Jobs</h1>
      <p className="text-xs text-fg-3">Refreshes automatically every 10 seconds.</p>

      <section className="card-surface p-5 space-y-3">
        <p className="section-label">Celery</p>
        {celeryLoading ? (
          <SectionSkeleton />
        ) : celeryError ? (
          <AdminErrorState onRetry={() => refetchCelery()} />
        ) : celery ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={celery.inspect_reachable} />
              <span>{celery.inspect_reachable ? "Broker reachable" : "Broker unreachable"}</span>
            </div>
            <p className="text-xs text-fg-3">
              Workers online: {celery.workers_online.length ? celery.workers_online.join(", ") : "none"}
            </p>
            <p className="text-xs text-fg-3">
              Active: {celery.active.length} · Scheduled: {celery.scheduled.length} · Reserved: {celery.reserved.length}
            </p>
            {celery.locks_held.length > 0 && (
              <p className="text-xs text-accent">Locks held: {celery.locks_held.join(", ")}</p>
            )}
            <div className="pt-2">
              <p className="section-label mb-2">Beat schedule</p>
              <ul className="space-y-1 text-xs text-fg-3">
                {celery.beat_schedule.map((entry) => (
                  <li key={entry.name}>
                    <span className="text-fg-1">{entry.task}</span> — {entry.schedule}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </section>

      <section className="card-surface p-5 space-y-3">
        <p className="section-label">Kafka Consumers</p>
        {kafkaLoading ? (
          <SectionSkeleton />
        ) : kafkaError ? (
          <AdminErrorState onRetry={() => refetchKafka()} />
        ) : kafka ? (
          <ul className="space-y-2">
            {kafka.workers.map((w) => (
              <li key={w.name} className="flex items-center gap-2 text-sm">
                <StatusDot ok={w.alive} />
                <span className="text-fg-1">{w.name}</span>
                <span className="text-xs text-fg-3">
                  {w.alive
                    ? `last seen ~${Math.round(w.last_seen_seconds_ago ?? 0)}s ago`
                    : "not running"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
