"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { PlayerAvatar, TeamLogo } from "@/components/ui";
import { useMe } from "@/hooks/auth/useMe";
import {
  useLeague,
  useMyTeam,
  useProposeTrade,
  useTradeAction,
  useTradeFairnessPreview,
  useTradeRosters,
  useTrades,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import type { TRosterPlayer, TTradeFairness, TTradeOffer } from "@/types";

function FairnessBadge({ fairness }: { fairness: TTradeFairness | undefined }) {
  if (!fairness) return null;
  const isLopsided = fairness.verdict === "lopsided";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[3px] border px-3 py-2 text-xs ${
        isLopsided
          ? "border-[rgba(255,138,0,0.35)] bg-[rgba(255,138,0,0.08)] text-[#ff8a00]"
          : "border-success/35 bg-success/08 text-success"
      }`}
    >
      <span className="font-barlow-condensed font-700 uppercase tracking-[1px]">
        {isLopsided ? "Lopsided trade" : "Balanced trade"}
      </span>
      <span className="text-fg-2">
        {fairness.offered_value.toFixed(1)} avg pts vs {fairness.requested_value.toFixed(1)} avg pts
      </span>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  proposed: "#e2c368",
  accepted: "#00d4ff",
  executed: "#00e07f",
  rejected: "#ff3b5c",
  cancelled: "#71717d",
  vetoed: "#ff8a8a",
};

function PlayerToggle({
  player,
  selected,
  onToggle,
}: {
  player: TRosterPlayer;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between rounded-[3px] border px-3 py-2 text-left text-sm transition-colors ${
        selected
          ? "border-accent/50 bg-accent/8 text-accent"
          : "border-white/8 bg-surface-2 text-fg-1 hover:border-white/20"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <PlayerAvatar name={player.name} photoUrl={player.photo_url} size="sm" className="shrink-0" />
        <span className="truncate">{player.name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-fg-3">
        <span>{player.position}</span>
        {player.real_team ? (
          <TeamLogo teamName={player.real_team} logoUrl={player.real_team_logo_url} size="sm" />
        ) : null}
      </span>
    </button>
  );
}

export function TradesView() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const { username } = useMe();
  const { data: league } = useLeague(leagueId);
  const { isDraftMode } = useLeagueCompetitionMode(league);
  const { data: myTeam } = useMyTeam(leagueId);
  const isCommissioner = league?.owner?.username === username;
  const isActive = league?.status === "active";
  const enabled = isDraftMode && isActive;

  const { data: rosters } = useTradeRosters(leagueId, enabled);
  const { data: trades } = useTrades(leagueId, enabled);
  const propose = useProposeTrade(leagueId);
  const action = useTradeAction(leagueId);

  const [targetTeamId, setTargetTeamId] = useState("");
  const [offered, setOffered] = useState<Set<string>>(new Set());
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const myRoster = useMemo(
    () => rosters?.find((r) => r.team_id === myTeam?.id),
    [rosters, myTeam],
  );
  const otherTeams = useMemo(
    () => (rosters ?? []).filter((r) => r.team_id !== myTeam?.id),
    [rosters, myTeam],
  );
  const targetRoster = useMemo(
    () => rosters?.find((r) => r.team_id === targetTeamId),
    [rosters, targetTeamId],
  );

  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  };

  // Debounce the fairness preview so it doesn't refetch on every single toggle.
  const [debouncedOffered, setDebouncedOffered] = useState<string[]>([]);
  const [debouncedRequested, setDebouncedRequested] = useState<string[]>([]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedOffered([...offered]);
      setDebouncedRequested([...requested]);
    }, 300);
    return () => window.clearTimeout(id);
  }, [offered, requested]);

  const { data: fairnessPreview } = useTradeFairnessPreview(
    leagueId,
    debouncedOffered,
    debouncedRequested,
    !!targetTeamId,
  );

  const canSubmit =
    !!targetTeamId &&
    offered.size > 0 &&
    offered.size === requested.size &&
    !propose.isPending;

  const handlePropose = async () => {
    try {
      await propose.mutateAsync({
        to_team_id: targetTeamId,
        offered_player_ids: [...offered],
        requested_player_ids: [...requested],
      });
      setOffered(new Set());
      setRequested(new Set());
      setTargetTeamId("");
    } catch {
      // shared mutation toast surfaces the error
    }
  };

  if (!isDraftMode) {
    return (
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-fg-1">
        <NavigationTabs activeTab="trades" leagueId={leagueId} isCommissioner={isCommissioner} />
        <div className="card-surface p-8 text-center text-sm text-fg-3">
          Trades are only available in draft leagues.
        </div>
      </section>
    );
  }

  const actLabel = action.isPending ? "…" : null;

  return (
    <section className="mx-auto max-w-6xl space-y-5 px-6 py-8 text-fg-1">
      <NavigationTabs activeTab="trades" leagueId={leagueId} isCommissioner={isCommissioner} />

      <header className="border-b border-white/8 pb-4">
        <p className="section-label">{league?.name || "League"}</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-fg-1 sm:text-6xl">
          Trades
        </h1>
        <p className="mt-1 text-sm text-fg-3">
          Propose an even swap with another manager. Accepted trades finalise after
          a commissioner veto window.
        </p>
      </header>

      {!isActive ? (
        <div className="card-surface p-6 text-sm text-fg-2">
          Trading opens once the season is active.
        </div>
      ) : (
        <>
          {/* Propose */}
          <div className="card-surface p-5">
            <span className="section-label">Propose a Trade</span>
            <select
              value={targetTeamId}
              onChange={(e) => {
                setTargetTeamId(e.target.value);
                setRequested(new Set());
              }}
              className="mt-3 w-full rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-sm text-fg-1 outline-none focus:border-accent"
              style={{ colorScheme: "dark" }}
            >
              <option value="">Select a team to trade with…</option>
              {otherTeams.map((t) => (
                <option key={t.team_id} value={t.team_id}>
                  {t.team_name}
                </option>
              ))}
            </select>

            {targetTeamId ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-success">
                    You give ({offered.size})
                  </p>
                  <div className="space-y-1.5">
                    {(myRoster?.players ?? []).map((p) => (
                      <PlayerToggle
                        key={p.id}
                        player={p}
                        selected={offered.has(p.id)}
                        onToggle={() => toggle(offered, setOffered, p.id)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-info">
                    You receive ({requested.size})
                  </p>
                  <div className="space-y-1.5">
                    {(targetRoster?.players ?? []).map((p) => (
                      <PlayerToggle
                        key={p.id}
                        player={p}
                        selected={requested.has(p.id)}
                        onToggle={() => toggle(requested, setRequested, p.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {targetTeamId && fairnessPreview ? (
              <div className="mt-4">
                <FairnessBadge fairness={fairnessPreview} />
              </div>
            ) : null}

            {targetTeamId ? (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-fg-3">
                  Trades must be even — same number of players each way.
                </p>
                <button
                  type="button"
                  onClick={handlePropose}
                  disabled={!canSubmit}
                  className="rounded-[3px] bg-accent px-6 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {propose.isPending ? "Proposing…" : "Propose Trade"}
                </button>
              </div>
            ) : null}
          </div>

          {/* My trades */}
          <div className="card-surface p-5">
            <span className="section-label">My Trades</span>
            {(trades?.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-fg-3">No trades yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {trades!.map((t) => (
                  <TradeRow
                    key={t.id}
                    trade={t}
                    isCommissioner={isCommissioner}
                    disabled={action.isPending}
                    actLabel={actLabel}
                    onAction={(a) => action.mutate({ tradeId: t.id, action: a })}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function TradeRow({
  trade,
  isCommissioner,
  disabled,
  actLabel,
  onAction,
}: {
  trade: TTradeOffer;
  isCommissioner: boolean;
  disabled: boolean;
  actLabel: string | null;
  onAction: (a: "accept" | "reject" | "cancel" | "veto") => void;
}) {
  const names = (list: { name: string }[]) => list.map((p) => p.name).join(", ");
  const btn =
    "rounded-[3px] px-3 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] transition-colors disabled:opacity-50";

  return (
    <li className="rounded-[3px] border border-white/6 bg-surface-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-fg-3">
          {trade.direction === "incoming"
            ? `From ${trade.from_team.name}`
            : `To ${trade.to_team.name}`}
        </span>
        <span
          className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px]"
          style={{ color: STATUS_COLORS[trade.status] ?? "#a0a0aa" }}
        >
          {trade.status}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-fg-1">
        <span className="text-success">
          {trade.direction === "incoming" ? "You get" : "You give"}:
        </span>{" "}
        {names(trade.direction === "incoming" ? trade.requested : trade.offered)}
      </p>
      <p className="text-sm text-fg-1">
        <span className="text-info">
          {trade.direction === "incoming" ? "You give" : "You get"}:
        </span>{" "}
        {names(trade.direction === "incoming" ? trade.offered : trade.requested)}
      </p>

      {trade.status === "proposed" || trade.status === "accepted" ? (
        <div className="mt-2">
          <FairnessBadge fairness={trade.fairness} />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {trade.status === "proposed" && trade.direction === "incoming" ? (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAction("accept")}
              className={`${btn} bg-accent text-black hover:bg-accent-bright`}
            >
              {actLabel ?? "Accept"}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAction("reject")}
              className={`${btn} border border-[rgba(255,59,48,0.4)] text-danger hover:bg-[rgba(255,59,48,0.1)]`}
            >
              Reject
            </button>
          </>
        ) : null}
        {trade.status === "proposed" && trade.direction === "outgoing" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction("cancel")}
            className={`${btn} border border-white/10 text-fg-2 hover:text-fg-1`}
          >
            Cancel
          </button>
        ) : null}
        {trade.status === "accepted" && isCommissioner ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction("veto")}
            className={`${btn} border border-[rgba(255,59,48,0.4)] text-danger hover:bg-[rgba(255,59,48,0.1)]`}
          >
            Veto
          </button>
        ) : null}
        {trade.status === "accepted" ? (
          <span className="self-center text-xs text-fg-3">
            Finalises after the veto window
          </span>
        ) : null}
      </div>
    </li>
  );
}
