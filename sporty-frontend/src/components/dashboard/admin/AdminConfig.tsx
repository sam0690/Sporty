"use client";

import { useAuth } from "@/context/auth-context";
import { hasMinRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { useSystemConfig, useToggleRealtimePipeline, useToggleLivePolling } from "@/hooks/admin/useAdminConfig";

function flagEnabled(value: { enabled?: boolean } | undefined): boolean {
  return Boolean(value?.enabled);
}

export function AdminConfig() {
  const { user: currentAdmin } = useAuth();
  const isSuperAdmin = hasMinRole(currentAdmin?.role, "super_admin");

  const { data: config } = useSystemConfig();
  const togglePipeline = useToggleRealtimePipeline();
  const toggleLivePolling = useToggleLivePolling();

  const pipelineRow = config?.find((c) => c.key === "realtime_pipeline_enabled");
  const livePollingRow = config?.find((c) => c.key === "live_polling_enabled");

  return (
    <div className="space-y-6">
      <h1 className="font-bebas text-4xl tracking-[2px] text-[#f0f0f0]">Config</h1>

      <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 space-y-3">
        <p className="section-label">Live external-API polling (football / NBA)</p>
        <p className="text-xs text-[#555560]">
          Takes effect on the next scheduled poll run. Currently:{" "}
          <span className={flagEnabled(livePollingRow?.value) ? "text-[#4ade80]" : "text-[#ff3b30]"}>
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
        <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 space-y-3">
          <p className="section-label">Realtime Kafka pipeline</p>
          <p className="text-xs text-[#555560]">
            Wired at process startup — toggling this here does not affect the currently running backend
            process, only the next restart. Currently:{" "}
            <span className={flagEnabled(pipelineRow?.value) ? "text-[#4ade80]" : "text-[#ff3b30]"}>
              {flagEnabled(pipelineRow?.value) ? "Enabled" : "Disabled"}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={togglePipeline.isPending}
              onClick={() => {
                if (window.confirm("Flip the realtime pipeline flag for the next backend restart?")) {
                  togglePipeline.mutate({ enabled: true });
                }
              }}
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
    </div>
  );
}
