"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus, Lock, Target } from "lucide-react";

import { useMatchStore } from "@/store/matchStore";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/lib/route.config";
import {
  useMyPrediction,
  useSubmitPrediction,
} from "@/hooks/predictions/usePredictions";
import { tierForPoints, RUBRIC_HINTS } from "@/features/predictions/scoring";
import { teamIdentity } from "@/lib/teamIdentity";
import { Button, TeamLogo } from "@/components/ui";

function Stepper({
  value,
  onChange,
  disabled,
  accent,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  accent: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid size-11 place-items-center rounded-full border border-white/12 text-fg-2 transition-[color,border-color,background-color] duration-150 hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-25"
      >
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      <span
        className="w-14 text-center font-display text-5xl leading-none tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        disabled={disabled || value >= 99}
        onClick={() => onChange(Math.min(99, value + 1))}
        className="grid size-11 place-items-center rounded-full border border-white/12 text-fg-2 transition-[color,border-color,background-color] duration-150 hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-25"
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function TeamHead({
  name,
  logoUrl,
  color,
}: {
  name: string;
  logoUrl: string | null;
  color: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <TeamLogo teamName={name} logoUrl={logoUrl} size="md" />
      <span className="max-w-[8rem] truncate text-center font-sans text-xs font-700 uppercase tracking-[1px] text-fg-1">
        {name}
      </span>
      <span
        aria-hidden
        className="h-0.5 w-8 rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export function PredictCard({ matchId }: { matchId: string }) {
  const homeTeam = useMatchStore((s) => s.homeTeam) ?? "Home";
  const awayTeam = useMatchStore((s) => s.awayTeam) ?? "Away";
  const homeLogo = useMatchStore((s) => s.homeTeamLogoUrl);
  const awayLogo = useMatchStore((s) => s.awayTeamLogoUrl);
  const sport = useMatchStore((s) => s.sport);
  const status = useMatchStore((s) => s.status);
  const score = useMatchStore((s) => s.score);

  const { user, isLoading: authLoading } = useAuth();
  const isAuthed = Boolean(user);
  const { data: existing, isLoading } = useMyPrediction(matchId, isAuthed);
  const submit = useSubmitPrediction(matchId);

  // Draft is null until the user touches a stepper; the displayed value falls
  // back to any saved prediction — derives from `existing` without a sync effect.
  const [draftHome, setDraftHome] = useState<number | null>(null);
  const [draftAway, setDraftAway] = useState<number | null>(null);
  const home = draftHome ?? existing?.predicted_home ?? 0;
  const away = draftAway ?? existing?.predicted_away ?? 0;

  const homeColor = teamIdentity(homeTeam).color;
  const awayColor = teamIdentity(awayTeam).color;

  if (sport && sport !== "football") {
    return (
      <div className="mx-auto max-w-md card-surface p-6 text-center text-sm text-fg-3">
        Predictions are available for football fixtures only.
      </div>
    );
  }

  // Guests can view fixtures but must sign in to predict. Send them to login
  // with a redirect straight back to this fixture's Predict tab.
  if (!isAuthed) {
    if (authLoading) {
      return <div className="mx-auto h-56 max-w-md skeleton rounded-[3px]" />;
    }
    const back = `/fixtures/${matchId}?tab=predict`;
    return (
      <div className="mx-auto max-w-md card-surface p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent/12 text-accent">
          <Target className="size-6" strokeWidth={2} />
        </span>
        <p className="mt-4 font-display text-lg text-fg-1">
          {homeTeam} v {awayTeam}
        </p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-fg-3">
          Sign in to call the final score and earn points on the Predictor
          leaderboard.
        </p>
        <Link
          href={`${ROUTES.LOGIN.path}?redirect=${encodeURIComponent(back)}`}
          className="mt-5 inline-block"
        >
          <Button type="button">Log in to predict</Button>
        </Link>
        <div className="mt-6 flex items-center justify-center gap-4">
          {RUBRIC_HINTS.map((h) => (
            <span
              key={h.pts}
              className="flex items-center gap-1.5 font-sans text-[11px] text-fg-3"
            >
              <span className="font-700 tabular-nums text-accent-dim">
                {h.pts}
              </span>
              {h.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Backend is authoritative on locking (rejects post-kickoff with 409); this is
  // UX-only. `existing.locked` is computed server-side against kickoff; for a
  // fresh fixture fall back to the live-updating store status.
  const locked = existing?.locked ?? status !== "scheduled";
  const resolved = existing?.points_awarded != null;
  const isLive = status === "live";

  // Only block re-submitting an unchanged saved prediction; a fresh 0–0 is
  // always submittable.
  const unchanged =
    existing != null &&
    existing.predicted_home === home &&
    existing.predicted_away === away;

  if (resolved && existing) {
    const tier = tierForPoints(existing.points_awarded!);
    const hit = home === existing.home_score && away === existing.away_score;
    return (
      <div className="mx-auto max-w-md card-surface p-6 text-center">
        <p className="font-sans text-[11px] font-700 uppercase tracking-[1.5px] text-fg-3">
          Your prediction
        </p>
        <div className="mt-4 flex items-center justify-center gap-5">
          <TeamHead name={existing.home_team} logoUrl={homeLogo} color={homeColor} />
          <span className="font-display text-5xl leading-none tabular-nums text-fg-1">
            {existing.predicted_home}
            <span className="px-2 text-white/20">:</span>
            {existing.predicted_away}
          </span>
          <TeamHead name={existing.away_team} logoUrl={awayLogo} color={awayColor} />
        </div>

        <p className="mt-4 font-sans text-xs text-fg-3">
          Full time&nbsp;
          <span className="font-700 tabular-nums text-fg-1">
            {existing.home_score}–{existing.away_score}
          </span>
        </p>

        <div className="mt-5 flex items-center justify-center">
          <span
            className={`inline-flex animate-fade-in-scale items-center gap-2 rounded-full px-4 py-1.5 font-sans text-sm font-700 ${tier.chip}`}
          >
            <span className="tabular-nums">+{existing.points_awarded}</span>
            <span className="opacity-40">·</span>
            {hit ? "Exact score!" : tier.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md card-surface p-6">
      <div className="flex items-center justify-center gap-2">
        {locked ? <Lock className="size-3 text-fg-3" strokeWidth={2.5} /> : null}
        <p className="font-sans text-[11px] font-700 uppercase tracking-[1.5px] text-fg-3">
          {locked ? "Prediction locked" : "Predict the final score"}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div className="flex flex-col items-center gap-3">
          <TeamHead name={homeTeam} logoUrl={homeLogo} color={homeColor} />
          {locked ? (
            <span
              className="font-display text-5xl leading-none tabular-nums"
              style={{ color: homeColor }}
            >
              {home}
            </span>
          ) : (
            <Stepper
              value={home}
              onChange={setDraftHome}
              disabled={isLoading}
              accent={homeColor}
              ariaLabel={`${homeTeam} score`}
            />
          )}
        </div>

        <span className="self-center pt-9 font-display text-2xl text-white/20">
          :
        </span>

        <div className="flex flex-col items-center gap-3">
          <TeamHead name={awayTeam} logoUrl={awayLogo} color={awayColor} />
          {locked ? (
            <span
              className="font-display text-5xl leading-none tabular-nums"
              style={{ color: awayColor }}
            >
              {away}
            </span>
          ) : (
            <Stepper
              value={away}
              onChange={setDraftAway}
              disabled={isLoading}
              accent={awayColor}
              ariaLabel={`${awayTeam} score`}
            />
          )}
        </div>
      </div>

      {locked ? (
        <div className="mt-6 space-y-2 text-center">
          {isLive && (
            <p className="inline-flex items-center gap-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-danger-soft">
              <span className="size-1.5 animate-live-pulse rounded-full bg-danger" />
              Live&nbsp;
              <span className="tabular-nums text-fg-1">
                {score.home}–{score.away}
              </span>
            </p>
          )}
          <p className="text-xs text-fg-3">
            {existing
              ? "Locked at kickoff — points land when the match finishes."
              : "This match has kicked off. Predictions are closed."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
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
            {submit.isPending
              ? "Saving…"
              : existing
                ? "Update prediction"
                : "Submit prediction"}
          </Button>
          <div className="flex items-center justify-center gap-4">
            {RUBRIC_HINTS.map((h) => (
              <span
                key={h.pts}
                className="flex items-center gap-1.5 font-sans text-[11px] text-fg-3"
              >
                <span className="font-700 tabular-nums text-accent-dim">
                  {h.pts}
                </span>
                {h.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
