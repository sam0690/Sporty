"use client";

import { useState } from "react";
import Link from "next/link";

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
import type { TLeaderboardRow, TPrediction } from "@/types/prediction";

function outcomeLabel(p: TPrediction): { text: string; tone: string } {
  if (p.points_awarded == null) {
    return p.locked
      ? { text: "Awaiting result", tone: "text-fg-3" }
      : { text: "Open", tone: "text-accent" };
  }
  if (p.points_awarded >= 5) return { text: "+5 Exact", tone: "text-accent" };
  if (p.points_awarded >= 3) return { text: "+3 Result + GD", tone: "text-fg-1" };
  if (p.points_awarded >= 1) return { text: "+1 Result", tone: "text-fg-1" };
  return { text: "0 pts", tone: "text-fg-3" };
}

function MyPredictions() {
  const { data, isLoading, isError, refetch } = useMyPredictions();

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading)
    return <div className="skeleton h-40 rounded-[3px]" />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="No predictions yet"
        description="Open an upcoming football fixture and predict the score to get on the board."
        actions={[{ label: "Browse fixtures", href: "/fixtures" }]}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {data.items.map((p) => {
        const outcome = outcomeLabel(p);
        return (
          <li key={p.id}>
            <Link
              href={`/fixtures/${p.match_id}?tab=predict`}
              className="flex items-center justify-between gap-3 card-surface px-4 py-3 transition-colors hover:bg-surface-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-fg-1">
                {p.home_team} v {p.away_team}
              </span>
              <span className="shrink-0 font-display text-lg tabular-nums text-fg-1">
                {p.predicted_home}–{p.predicted_away}
                {p.home_score != null && (
                  <span className="ml-2 text-xs text-fg-3">
                    (FT {p.home_score}–{p.away_score})
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 font-sans text-xs font-700 uppercase tracking-[1px] ${outcome.tone}`}
              >
                {outcome.text}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
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

  const columns: TableColumn<TLeaderboardRow>[] = [
    { key: "rank", header: "#", render: (r) => r.rank },
    { key: "username", header: "Player", render: (r) => r.username },
    {
      key: "exact",
      header: "Exact",
      align: "right",
      render: (r) => r.exact_scores,
    },
    {
      key: "made",
      header: "Predictions",
      align: "right",
      render: (r) => r.predictions_made,
    },
    {
      key: "points",
      header: "Points",
      align: "right",
      render: (r) => (
        <span className="font-700 tabular-nums text-accent">
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
          <span className="text-xs text-fg-3">
            You: #{data.me.rank} · {data.me.total_points} pts
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
          emptyMessage="No scored predictions yet — check back after matches finish."
        />
      )}
    </div>
  );
}

export function PredictorView() {
  return (
    <PageContainer>
      <PageHeader
        title="Predictor"
        subtitle="Predict scores, earn points, climb the table"
      />
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
