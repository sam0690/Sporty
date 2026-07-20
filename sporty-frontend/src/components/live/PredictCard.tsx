"use client";

import { useState } from "react";

import { useMatchStore } from "@/store/matchStore";
import {
  useMyPrediction,
  useSubmitPrediction,
} from "@/hooks/predictions/usePredictions";
import { Button } from "@/components/ui";

/** Points tier a resolved prediction landed in — mirrors the backend 5/3/1/0
 *  rubric (app/prediction/services.py) purely for a human label. */
function tierLabel(points: number): string {
  if (points >= 5) return "Exact score!";
  if (points >= 3) return "Right result + goal difference";
  if (points >= 1) return "Right result";
  return "Missed";
}

function ScoreStepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="max-w-[8rem] truncate text-center font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="size-9 rounded-[3px] border border-white/12 text-lg font-700 text-fg-1 transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
        >
          −
        </button>
        <span className="w-10 text-center font-display text-3xl tabular-nums text-fg-1">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= 99}
          onClick={() => onChange(Math.min(99, value + 1))}
          className="size-9 rounded-[3px] border border-white/12 text-lg font-700 text-fg-1 transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PredictCard({ matchId }: { matchId: string }) {
  const homeTeam = useMatchStore((s) => s.homeTeam) ?? "Home";
  const awayTeam = useMatchStore((s) => s.awayTeam) ?? "Away";
  const sport = useMatchStore((s) => s.sport);
  const status = useMatchStore((s) => s.status);
  const score = useMatchStore((s) => s.score);

  const { data: existing, isLoading } = useMyPrediction(matchId);
  const submit = useSubmitPrediction(matchId);

  // Draft is null until the user touches a stepper; the displayed value falls
  // back to any saved prediction. This derives from `existing` without a
  // state-sync effect.
  const [draftHome, setDraftHome] = useState<number | null>(null);
  const [draftAway, setDraftAway] = useState<number | null>(null);
  const home = draftHome ?? existing?.predicted_home ?? 0;
  const away = draftAway ?? existing?.predicted_away ?? 0;

  if (sport && sport !== "football") {
    return (
      <div className="mx-auto max-w-md card-surface p-6 text-center text-sm text-fg-3">
        Predictions are available for football fixtures only.
      </div>
    );
  }

  // Backend is authoritative on locking (rejects post-kickoff with 409); this
  // is UX-only. `existing.locked` is computed server-side against kickoff; for
  // a fresh fixture fall back to the live-updating store status.
  const locked = existing?.locked ?? status !== "scheduled";
  const resolved = existing?.points_awarded != null;

  // Only block re-submitting an unchanged saved prediction; a fresh 0–0 is
  // always submittable.
  const unchanged =
    existing != null &&
    existing.predicted_home === home &&
    existing.predicted_away === away;

  return (
    <div className="mx-auto max-w-md space-y-5 card-surface p-6">
      {resolved && existing ? (
        <div className="space-y-3 text-center">
          <p className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
            Your prediction
          </p>
          <div className="flex items-center justify-center gap-4 font-display text-4xl tabular-nums text-fg-1">
            <span>{existing.predicted_home}</span>
            <span className="text-white/20">:</span>
            <span>{existing.predicted_away}</span>
          </div>
          <p className="text-sm text-fg-2">
            Final: {existing.home_score}–{existing.away_score}
          </p>
          <p className="font-sans text-xs font-700 uppercase tracking-[1px] text-accent">
            +{existing.points_awarded} pts · {tierLabel(existing.points_awarded!)}
          </p>
        </div>
      ) : (
        <>
          <p className="text-center font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
            {locked ? "Your prediction (locked)" : "Predict the final score"}
          </p>
          <div className="flex items-center justify-center gap-6">
            <ScoreStepper
              label={homeTeam}
              value={home}
              onChange={setDraftHome}
              disabled={locked}
            />
            <span className="pt-6 font-display text-2xl text-white/20">:</span>
            <ScoreStepper
              label={awayTeam}
              value={away}
              onChange={setDraftAway}
              disabled={locked}
            />
          </div>

          {locked ? (
            <p className="text-center text-xs text-fg-3">
              {existing
                ? "Predictions lock at kickoff."
                : "This match has kicked off — predictions are closed."}
            </p>
          ) : (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={submit.isPending || unchanged || isLoading}
                onClick={() =>
                  submit.mutate({
                    match_id: matchId,
                    predicted_home: home,
                    predicted_away: away,
                  })
                }
              >
                {existing ? "Update prediction" : "Submit prediction"}
              </Button>
              <p className="text-center text-[11px] text-fg-3">
                Exact score = 5 pts · right result + goal difference = 3 · right
                result = 1
              </p>
            </>
          )}

          {locked && score && (status === "live" || status === "finished") && (
            <p className="text-center text-sm text-fg-2">
              Live: {score.home}–{score.away}
            </p>
          )}
        </>
      )}
    </div>
  );
}
