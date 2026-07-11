"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasMinRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { AdminDetailSkeleton } from "@/components/dashboard/admin/AdminDetailSkeleton";
import { AdminErrorState } from "@/components/dashboard/admin/AdminErrorState";
import { ConfirmDialog } from "@/components/dashboard/admin/ConfirmDialog";
import { useSystemConfig, useToggleRealtimePipeline, useToggleLivePolling } from "@/hooks/admin/useAdminConfig";

function flagEnabled(value: { enabled?: boolean } | undefined): boolean {
  return Boolean(value?.enabled);
}

export function AdminConfig() {
  const { user: currentAdmin } = useAuth();
  const isSuperAdmin = hasMinRole(currentAdmin?.role, "super_admin");

  const { data: config, isLoading, isError, refetch } = useSystemConfig();
  const togglePipeline = useToggleRealtimePipeline();
  const toggleLivePolling = useToggleLivePolling();
  const [showEnablePipelineConfirm, setShowEnablePipelineConfirm] = useState(false);

  const pipelineRow = config?.find((c) => c.key === "realtime_pipeline_enabled");
  const livePollingRow = config?.find((c) => c.key === "live_polling_enabled");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-bebas text-4xl tracking-[2px] text-fg-1">Config</h1>
        <AdminDetailSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="font-bebas text-4xl tracking-[2px] text-fg-1">Config</h1>
        <AdminErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-bebas text-4xl tracking-[2px] text-fg-1">Config</h1>

      <section className="card-surface p-5 space-y-3">
        <p className="section-label">Live external-API polling (football / NBA)</p>
        <p className="text-xs text-fg-3">
          Takes effect on the next scheduled poll run. Currently:{" "}
          <span className={flagEnabled(livePollingRow?.value) ? "text-success" : "text-danger"}>
            {flagEnabled(livePollingRow?.value) ? "Enabled" : "Disabled"}
          </span>
        </p>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={toggleLivePolling.isPending}
            onClick={() => toggleLivePolling.mutate({ enabled: true })}
          >
            Enable
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={toggleLivePolling.isPending}
            onClick={() => toggleLivePolling.mutate({ enabled: false })}
          >
            Disable
          </Button>
        </div>
      </section>

      {isSuperAdmin && (
        <section className="card-surface p-5 space-y-3">
          <p className="section-label">Realtime Kafka pipeline</p>
          <p className="text-xs text-fg-3">
            Wired at process startup — toggling this here does not affect the currently running backend
            process, only the next restart. Currently:{" "}
            <span className={flagEnabled(pipelineRow?.value) ? "text-success" : "text-danger"}>
              {flagEnabled(pipelineRow?.value) ? "Enabled" : "Disabled"}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={togglePipeline.isPending}
              onClick={() => setShowEnablePipelineConfirm(true)}
            >
              Enable
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={togglePipeline.isPending}
              onClick={() => togglePipeline.mutate({ enabled: false })}
            >
              Disable
            </Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={showEnablePipelineConfirm}
        title="Enable Realtime Pipeline"
        message="Flip the realtime pipeline flag for the next backend restart?"
        confirmLabel="Enable"
        variant="danger"
        isPending={togglePipeline.isPending}
        onClose={() => setShowEnablePipelineConfirm(false)}
        onConfirm={() =>
          togglePipeline.mutate({ enabled: true }, { onSuccess: () => setShowEnablePipelineConfirm(false) })
        }
      />
    </div>
  );
}
