"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CompetitionLogo } from "@/components/ui/CompetitionLogo";
import { competitionMeta } from "@/lib/footballCompetitions";
import { useCompetitionMatch } from "@/hooks/competitions/useCompetitions";
import type { TCompetitionMatch } from "@/types/competition";

function stageLabel(stage?: string | null): string | null {
  if (!stage) return null;
  const map: Record<string, string> = {
    LEAGUE_STAGE: "League phase",
    GROUP_STAGE: "Group stage",
    PLAYOFFS: "Play-offs",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter-final",
    SEMI_FINALS: "Semi-final",
    FINAL: "Final",
  };
  return map[stage] ?? stage.replace(/_/g, " ");
}

function TeamCol({ name, crest }: { name: string; crest?: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3 text-center">
      {crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={crest} alt="" className="size-14 object-contain sm:size-20" loading="lazy" />
      ) : (
        <span className="size-14 rounded-full bg-surface-3 sm:size-20" />
      )}
      <span className="text-sm font-700 text-fg-1 sm:text-base">{name}</span>
    </div>
  );
}

function Hero({ match }: { match: TCompetitionMatch }) {
  const ft = match.score?.fullTime;
  const ht = match.score?.halfTime;
  const played = ft?.home != null && ft?.away != null;
  const kickoff = new Date(match.utcDate);
  const isLive = ["IN_PLAY", "PAUSED"].includes(match.status);

  return (
    <div className="card-surface px-4 py-8 sm:px-8">
      <div className="mb-6 flex items-center justify-center gap-3 text-center">
        {stageLabel(match.stage) && (
          <span className="section-label">{stageLabel(match.stage)}</span>
        )}
        {match.matchday && !match.stage?.includes("FINAL") && (
          <span className="text-xs text-fg-3">MD {match.matchday}</span>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-6">
        <TeamCol name={match.homeTeam.name} crest={match.homeTeam.crest} />

        <div className="flex shrink-0 flex-col items-center gap-1.5">
          {played ? (
            <span className="font-display text-4xl leading-none tracking-[-0.02em] tabular-nums text-fg-1 sm:text-5xl">
              {ft!.home}
              <span className="mx-1.5 text-fg-3">–</span>
              {ft!.away}
            </span>
          ) : (
            <span className="font-display text-2xl leading-none tracking-[-0.02em] text-fg-2">
              {kickoff.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-700 uppercase tracking-[1.5px] text-danger">
              <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
              Live
            </span>
          ) : played ? (
            <>
              <span className="text-[10px] font-700 uppercase tracking-[1.5px] text-fg-3">
                Full time
              </span>
              {ht?.home != null && ht?.away != null && (
                <span className="text-[11px] tabular-nums text-fg-3">
                  HT {ht.home}–{ht.away}
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] uppercase tracking-[1.5px] text-fg-3">
              {kickoff.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        <TeamCol name={match.awayTeam.name} crest={match.awayTeam.crest} />
      </div>
    </div>
  );
}

export function CompetitionMatchDetail({ tag, matchId }: { tag: string; matchId: string }) {
  const { data, isLoading, isError } = useCompetitionMatch(tag.toUpperCase(), matchId);
  const meta = competitionMeta(tag.toUpperCase());

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={`/competitions/${tag.toLowerCase()}`}
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-700 uppercase tracking-[1.5px] text-fg-3 transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-3.5" />
        <CompetitionLogo tag={tag.toUpperCase()} className="size-4" />
        {meta?.label ?? "Competition"}
      </Link>

      {isLoading ? (
        <div className="skeleton h-64 rounded-[3px] border border-white/6" />
      ) : isError || !data ? (
        <div className="card-surface px-6 py-16 text-center text-sm text-fg-2">
          This match couldn&apos;t be found.
        </div>
      ) : (
        <Hero match={data.match} />
      )}
    </div>
  );
}
