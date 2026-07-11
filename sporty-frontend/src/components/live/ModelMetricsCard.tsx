"use client";

import type { ModelMetrics } from "@/types/events";
import { Panel } from "./Panel";
import { ChartIcon } from "./icons";

type ModelMetricsCardProps = {
  metrics: ModelMetrics | null;
};

/** How the prediction model has actually performed: its stored pre-match
 *  predictions scored against final results, per model version. Pushed by the
 *  data feeder after every finished match. */
export function ModelMetricsCard({ metrics }: ModelMetricsCardProps) {
  if (!metrics || metrics.predictions_scored === 0) {
    return null;
  }

  // Newest version first (versions sort lexically: v1 < v2 < v4).
  const versions = Object.entries(metrics.by_model_version).sort(([a], [b]) =>
    b.localeCompare(a),
  );

  return (
    <Panel
      title="Model Track Record"
      icon={<ChartIcon className="size-3.5" />}
      action={
        <span className="font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
          {metrics.finished_matches_scored} matches scored
        </span>
      }
    >
      <div className="space-y-3">
        {versions.map(([version, m]) => (
          <div
            key={version}
            className="flex items-center justify-between gap-3 border-b border-white/6 pb-3 last:border-b-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate font-sans text-[11px] font-700 uppercase tracking-[1px] text-fg-2">
                {version}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-fg-3">
                {m.n} prediction{m.n === 1 ? "" : "s"} · log loss{" "}
                {m.log_loss.toFixed(3)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl leading-none tracking-[-0.02em] text-fg-1">
                {Math.round(m.accuracy * 100)}%
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-fg-3">
                correct
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-white/6 pt-2.5 text-right text-[10px] uppercase tracking-wider text-fg-3">
        Updated {new Date(metrics.generated_at).toLocaleString()}
      </div>
    </Panel>
  );
}
