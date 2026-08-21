"use client";

import { useRef } from "react";
import { ChevronDown, ChevronUp, MinusCircle } from "lucide-react";
import { Tooltip } from "@mantine/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { LivePointsIndicator } from "@/components/shared/scoring";
import {
  NOT_SCORING_LABEL,
  notScoringTooltip,
  type NotScoringReason,
} from "@/features/leagues/leaderboardRows";

type PointsPenalty = {
  points_charged: number;
  reason: string;
  created_at: string;
};

const PENALTY_REASON_LABELS: Record<string, string> = {
  budget_overage: "Over-budget transfer",
};

type StandingRow = {
  rank: number | null;
  teamId: string | null;
  teamName: string | null;
  manager: string;
  points: number;
  rankDelta?: number | null;
  streak?: number;
  isManagerOfTheWeek?: boolean;
  /** Head-to-head W-L-T record, e.g. "4-2-1" — only set for H2H leagues. */
  record?: string;
  /** Points paid via the budget-overage penalty this scope (window or season). */
  pointsDeducted?: number;
  penalties?: PointsPenalty[];
  /** Set when this manager isn't scoring yet — see leaderboardRows.ts. */
  notScoringReason?: NotScoringReason;
  /** First gameweek they score from, shown when notScoringReason is set. */
  eligibleFromGameweek?: number | null;
};

function PenaltyBreakdown({ penalties, total }: { penalties: PointsPenalty[]; total: number }) {
  return (
    <div className="flex flex-col gap-1 py-0.5 text-xs">
      {penalties.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span>{PENALTY_REASON_LABELS[p.reason] ?? p.reason}</span>
          <span className="num">-{p.points_charged.toFixed(2)}</span>
        </div>
      ))}
      {penalties.length > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-1 font-700">
          <span>Total</span>
          <span className="num">-{total.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

type StandingsTableProps = {
  standings: StandingRow[];
  userTeamId: string;
  /** Signed-in username — the only way to highlight your own row when you have
   * no squad yet, since there's no team id to match on. */
  userName?: string;
  isLoading?: boolean;
  // Header label — "Standings" by default, or "Points"/"Gameweek Points" when
  // the caller wants the column context called out (e.g. per-gameweek view).
  pointsLabel?: string;
  emptyMessage?: string;
};

function isOwnRow(team: StandingRow, userTeamId: string, userName?: string) {
  return team.teamId === null
    ? !!userName && team.manager === userName
    : team.teamId === userTeamId;
}

const MEDAL_STYLE: Record<number, string> = {
  1: "bg-warning/15 text-warning border-warning/40",
  2: "bg-[rgba(200,208,220,0.12)] text-[#c8d0dc] border-[rgba(200,208,220,0.35)]",
  3: "bg-[rgba(205,127,50,0.15)] text-[#cd7f32] border-[rgba(205,127,50,0.4)]",
};

function RankDeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (!delta) return null;
  const isUp = delta > 0;
  const Icon = isUp ? ChevronUp : ChevronDown;
  return (
    <span
      className={`inline-flex items-center font-sans text-[11px] font-700 ${
        isUp ? "text-success" : "text-danger"
      }`}
      title={`${isUp ? "Up" : "Down"} ${Math.abs(delta)} rank vs last gameweek`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta)}
    </span>
  );
}

function StandingRowItem({ team, isUser }: { team: StandingRow; isUser: boolean }) {
  const medalClass = team.rank ? MEDAL_STYLE[team.rank] : undefined;
  const idle = team.notScoringReason;
  return (
    <div
      className={`flex items-center gap-4 border-b border-white/6 px-5 py-3.5 transition-colors hover:bg-surface-3 ${
        isUser ? "border-l-2 border-l-accent bg-accent/5" : "border-l-2 border-l-transparent"
      } ${idle ? "opacity-60" : ""}`}
    >
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-[3px] border font-display text-lg tracking-[-0.02em] ${
            medalClass ?? "border-white/8 bg-surface-3 text-fg-2"
          }`}
        >
          {team.rank ?? "—"}
        </span>
        <RankDeltaBadge delta={team.rankDelta} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
          {team.teamName ?? <span className="text-fg-3">No squad</span>}
          {isUser && <span className="ml-2 section-label text-accent-dim">You</span>}
          {team.isManagerOfTheWeek && (
            <span className="ml-2 text-xs" title="Manager of the Week — highest points last gameweek">
              🔥
            </span>
          )}
          {team.record && (
            <span className="ml-1.5 text-xs text-fg-2" title="Head-to-head record (W-L-T)">
              {team.record}
            </span>
          )}
          {team.streak && team.streak >= 2 ? (
            <span className="ml-1.5 text-xs text-fg-2" title={`Top 3 for ${team.streak} gameweeks running`}>
              {team.streak}W
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-fg-3">
          {team.manager}
          {idle && (
            <Tooltip
              label={notScoringTooltip(idle, team.eligibleFromGameweek)}
              multiline
              w={260}
              withArrow
            >
              <span className="cursor-help rounded-[2px] border border-white/12 bg-surface-3 px-1.5 py-0.5 text-[10px] font-700 uppercase tracking-[0.4px] text-fg-2">
                {idle === "pending_window" && team.eligibleFromGameweek
                  ? `Scores from GW ${team.eligibleFromGameweek}`
                  : NOT_SCORING_LABEL[idle]}
              </span>
            </Tooltip>
          )}
        </p>
      </div>

      <span className="flex shrink-0 items-center gap-1.5">
        {team.pointsDeducted ? (
          <Tooltip
            label={<PenaltyBreakdown penalties={team.penalties ?? []} total={team.pointsDeducted} />}
            multiline
            withArrow
          >
            <MinusCircle
              className="h-3.5 w-3.5 text-danger"
              aria-label={`${team.pointsDeducted.toFixed(2)} points deducted this week`}
            />
          </Tooltip>
        ) : null}
        {idle === "no_squad" ? (
          <span className="font-display text-lg text-fg-3">—</span>
        ) : (
          <LivePointsIndicator points={team.points} size="lg" className="!text-accent" />
        )}
      </span>
    </div>
  );
}

// Above this many rows, the list is windowed (only on-screen rows are in the
// DOM) so a large league leaderboard stays fast; below it, plain rendering
// (windowing overhead isn't worth it for short lists, and it keeps
// measurement simple).
const VIRTUALIZE_THRESHOLD = 30;

function VirtualStandings({
  standings,
  userTeamId,
  userName,
}: {
  standings: StandingRow[];
  userTeamId: string;
  userName?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: standings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="max-h-[70vh] overflow-y-auto overflow-x-hidden">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const team = standings[vi.index];
          return (
            <div
              key={team.teamId ?? team.manager}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
            >
              <StandingRowItem team={team} isUser={isOwnRow(team, userTeamId, userName)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StandingsTable({
  standings,
  userTeamId,
  userName,
  isLoading,
  pointsLabel = "Standings",
  emptyMessage = "No standings yet — they appear once teams are scored for a gameweek.",
}: StandingsTableProps) {
  return (
    <section className="overflow-hidden card-surface animate-fade-soft">
      <div className="border-b border-white/8 px-5 py-3">
        <h2 className="font-sans text-xs font-700 uppercase tracking-[3px] text-[#666]">
          {pointsLabel}
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-[3px] bg-surface-3" />
          ))}
        </div>
      ) : standings.length === 0 ? (
        <div className="p-6 text-sm text-fg-3">{emptyMessage}</div>
      ) : standings.length > VIRTUALIZE_THRESHOLD ? (
        <VirtualStandings
          standings={standings}
          userTeamId={userTeamId}
          userName={userName}
        />
      ) : (
        <div>
          {standings.map((team) => (
            <StandingRowItem
              // Teamless rows have no teamId; owner name is unique per league.
              key={team.teamId ?? team.manager}
              team={team}
              isUser={isOwnRow(team, userTeamId, userName)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export type { StandingRow, PointsPenalty };
