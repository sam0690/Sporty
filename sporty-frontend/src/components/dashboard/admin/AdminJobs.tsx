"use client";

import { AdminErrorState } from "@/components/dashboard/admin/AdminErrorState";
import { useCeleryJobs, useKafkaJobs } from "@/hooks/admin/useAdminJobs";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-[#4ade80]" : "bg-[#ff3b30]"}`}
      aria-hidden
    />
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-48 animate-pulse rounded-[3px] bg-[#1d1d26]" />
      <div className="h-4 w-64 animate-pulse rounded-[3px] bg-[#1d1d26]" />
    </div>
  );
}

export function AdminJobs() {
  const { data: celery, isLoading: celeryLoading, isError: celeryError, refetch: refetchCelery } = useCeleryJobs();
  const { data: kafka, isLoading: kafkaLoading, isError: kafkaError, refetch: refetchKafka } = useKafkaJobs();

  return (
    <div className="space-y-6">
      <h1 className="font-bebas text-4xl tracking-[2px] text-[#f0f0f0]">Jobs</h1>
      <p className="text-xs text-[#555560]">Refreshes automatically every 10 seconds.</p>

      <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 space-y-3">
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
            <p className="text-xs text-[#555560]">
              Workers online: {celery.workers_online.length ? celery.workers_online.join(", ") : "none"}
            </p>
            <p className="text-xs text-[#555560]">
              Active: {celery.active.length} · Scheduled: {celery.scheduled.length} · Reserved: {celery.reserved.length}
            </p>
            {celery.locks_held.length > 0 && (
              <p className="text-xs text-[#e8fb25]">Locks held: {celery.locks_held.join(", ")}</p>
            )}
            <div className="pt-2">
              <p className="section-label mb-2">Beat schedule</p>
              <ul className="space-y-1 text-xs text-[#555560]">
                {celery.beat_schedule.map((entry) => (
                  <li key={entry.name}>
                    <span className="text-[#f0f0f0]">{entry.task}</span> — {entry.schedule}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </section>

      <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 space-y-3">
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
                <span className="text-[#f0f0f0]">{w.name}</span>
                <span className="text-xs text-[#555560]">
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
