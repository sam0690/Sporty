"use client";

import { useState } from "react";
import Link from "next/link";
import { Target } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  Select,
  Table,
  type TableColumn,
} from "@/components/ui";
import { useMyLeagues } from "@/hooks/leagues/useLeagueCore";
import {
  useMyPredictions,
  usePredictionLeaderboard,
} from "@/hooks/predictions/usePredictions";
import { tierForPoints } from "@/features/predictions/scoring";
import type { TLeaderboardRow, TPrediction } from "@/types/prediction";

/* ── My predictions ─────────────────────────────────────────────────────── */

function ResultTag({ p }: { p: TPrediction }) {
  if (p.points_awarded == null) {
    return (
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 font-sans text-[11px] font-700 uppercase tracking-[0.5px] ${
          p.locked
            ? "bg-white/[0.06] text-fg-3"
            : "bg-accent/16 text-accent"
        }`}
      >
        {p.locked ? "Awaiting" : "Open"}
      </span>
    );
  }
  const tier = tierForPoints(p.points_awarded);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-sans text-[11px] font-700 uppercase tracking-[0.5px] ${tier.chip}`}
    >
      <span className="tabular-nums">+{p.points_awarded}</span>
      {tier.short}
    </span>
  );
}

function PredictionRow({ p }: { p: TPrediction }) {
  return (
    <Link
      href={`/fixtures/${p.match_id}?tab=predict`}
      className="flex items-center gap-3 rounded-[3px] card-surface px-4 py-3 transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-fg-1">
        {p.home_team} <span className="text-fg-3">v</span> {p.away_team}
      </span>
      <span className="shrink-0 text-center font-display text-lg leading-none tabular-nums text-fg-1">
        {p.predicted_home}
        <span className="px-1 text-white/20">:</span>
        {p.predicted_away}
        {p.home_score != null && (
          <span className="ml-2 align-middle font-sans text-[11px] font-600 text-fg-3">
            FT {p.home_score}–{p.away_score}
          </span>
        )}
      </span>
      <ResultTag p={p} />
    </Link>
  );
}

function MyPredictions() {
  const { data, isLoading, isError, refetch } = useMyPredictions();

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <div className="skeleton h-40 rounded-[3px]" />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="No predictions yet"
        description="Open an upcoming football fixture and call the final score to get on the board."
        actions={[{ label: "Browse fixtures", href: "/fixtures" }]}
      />
    );
  }
  return (
    <ul className="space-y-2">
      {data.items.map((p) => (
        <li key={p.id}>
          <PredictionRow p={p} />
        </li>
      ))}
    </ul>
  );
}

/* ── Personal summary ───────────────────────────────────────────────────── */

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1">
      <p className="font-display text-2xl leading-none tabular-nums text-fg-1">
        {value}
      </p>
      <p className="mt-1.5 font-sans text-[11px] font-700 uppercase tracking-[1px] text-fg-3">
        {label}
      </p>
    </div>
  );
}

function Summary() {
  // Global standing regardless of the leaderboard's scope selector; when that
  // selector is also on "global" React Query dedupes this to one request.
  const { data } = usePredictionLeaderboard();
  const me = data?.me;
  if (!me) return null;
  return (
    <div className="mb-8 flex items-center gap-6 card-surface px-6 py-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
        <Target className="size-5" strokeWidth={2} />
      </span>
      <SummaryStat label="Global rank" value={`#${me.rank}`} />
      <span className="h-8 w-px bg-white/8" />
      <SummaryStat label="Points" value={String(me.total_points)} />
      <span className="h-8 w-px bg-white/8" />
      <SummaryStat label="Exact scores" value={String(me.exact_scores)} />
    </div>
  );
}

/* ── Leaderboard ────────────────────────────────────────────────────────── */

const MEDAL_TONE: Record<number, string> = {
  1: "bg-accent/16 text-accent",
  2: "bg-white/10 text-[#c8ccd4]",
  3: "bg-[#cd8b5c]/16 text-[#cd8b5c]",
};

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        className={`grid size-6 place-items-center rounded-full font-sans text-xs font-700 tabular-nums ${MEDAL_TONE[rank]}`}
      >
        {rank}
      </span>
    );
  }
  return <span className="pl-1.5 tabular-nums text-fg-3">{rank}</span>;
}

function Leaderboard() {
  const { data: leagues } = useMyLeagues();
  const [scope, setScope] = useState("global");
  const leagueId = scope === "global" ? undefined : scope;
  const { data, isLoading, isError, refetch } =
    usePredictionLeaderboard(leagueId);

  const options = [
    { value: "global", label: "Global" },
    ...(leagues ?? []).map((l) => ({ value: l.id, label: l.name })),
  ];
  const meId = data?.me?.user_id;

  const columns: TableColumn<TLeaderboardRow>[] = [
    { key: "rank", header: "#", render: (r) => <RankCell rank={r.rank} /> },
    {
      key: "username",
      header: "Player",
      render: (r) => (
        <span className="font-600">
          {r.username}
          {r.user_id === meId && (
            <span className="ml-2 rounded-full bg-accent/16 px-1.5 py-0.5 font-sans text-[10px] font-700 uppercase tracking-[0.5px] text-accent">
              You
            </span>
          )}
        </span>
      ),
    },
    {
      key: "exact",
      header: "Exact",
      align: "right",
      render: (r) => <span className="tabular-nums text-fg-2">{r.exact_scores}</span>,
    },
    {
      key: "made",
      header: "Played",
      align: "right",
      render: (r) => <span className="tabular-nums text-fg-2">{r.predictions_made}</span>,
    },
    {
      key: "points",
      header: "Points",
      align: "right",
      render: (r) => (
        <span className="font-display text-base font-700 tabular-nums text-accent">
          {r.total_points}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Select
          aria-label="Leaderboard scope"
          value={scope}
          onChange={setScope}
          options={options}
        />
        {data?.me && (
          <span className="font-sans text-xs text-fg-3">
            You&apos;re{" "}
            <span className="font-700 text-fg-1">#{data.me.rank}</span> ·{" "}
            <span className="font-700 tabular-nums text-accent">
              {data.me.total_points}
            </span>{" "}
            pts
          </span>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="skeleton h-48 rounded-[3px]" />
      ) : (
        <Table
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(r) => r.user_id}
          rowClassName={(r) => (r.user_id === meId ? "bg-accent/[0.06]" : "")}
          emptyMessage="No scored predictions yet — points appear after matches finish."
        />
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export function PredictorView() {
  return (
    <PageContainer>
      <PageHeader
        title="Predictor"
        subtitle="Call the score, earn points, climb the table"
      />
      <Summary />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <section className="space-y-3">
          <h2 className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
            My predictions
          </h2>
          <MyPredictions />
        </section>
        <section className="space-y-3">
          <h2 className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
            Leaderboard
          </h2>
          <Leaderboard />
        </section>
      </div>
    </PageContainer>
  );
}
