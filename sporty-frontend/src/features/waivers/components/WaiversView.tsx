"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { CardSkeleton } from "@/components/ui/skeletons";
import { Modal, PlayerAvatar, TeamLogo } from "@/components/ui";
import { useMe } from "@/hooks/auth/useMe";
import {
  useCancelWaiverClaim,
  useFreeAgents,
  useLeague,
  useMyTeam,
  useReorderWaiverClaims,
  useSubmitWaiverClaim,
  useWaiverClaims,
  useWaiverOrder,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import type { TFreeAgent, TTeamPlayer } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "#e8fb25",
  success: "#4caf50",
  failed: "#ff3b30",
  cancelled: "#555560",
};

export function WaiversView() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const { username } = useMe();
  const { data: league } = useLeague(leagueId);
  const { isDraftMode } = useLeagueCompetitionMode(league);
  const { data: myTeam } = useMyTeam(leagueId);
  const isCommissioner = league?.owner?.username === username;
  const isActive = league?.status === "active";
  const enabled = isDraftMode && isActive;

  const { data: order } = useWaiverOrder(leagueId, enabled);
  const { data: claims, isLoading: claimsLoading } = useWaiverClaims(leagueId, enabled);
  const { data: pool } = useFreeAgents(leagueId, { limit: 100 }, enabled);
  const submit = useSubmitWaiverClaim(leagueId);
  const cancel = useCancelWaiverClaim(leagueId);
  const reorder = useReorderWaiverClaims(leagueId);

  const [search, setSearch] = useState("");
  const [addTarget, setAddTarget] = useState<TFreeAgent | null>(null);

  const squad: TTeamPlayer[] = useMemo(
    () => myTeam?.players ?? myTeam?.team_players ?? [],
    [myTeam],
  );

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    (pool?.items ?? []).forEach((p) => map.set(p.id, p.name));
    squad.forEach((tp) => map.set(tp.player.id, tp.player.name));
    return map;
  }, [pool, squad]);

  const filteredPool = useMemo(() => {
    const items = pool?.items ?? [];
    const q = search.trim().toLowerCase();
    return q ? items.filter((p) => p.name.toLowerCase().includes(q)) : items;
  }, [pool, search]);

  const dropCandidates = useMemo(() => {
    if (!addTarget) return [];
    return squad.filter((tp) => tp.player.sport.name === addTarget.sport);
  }, [squad, addTarget]);

  const pendingClaims = useMemo(
    () => (claims ?? []).filter((c) => c.status === "pending"),
    [claims],
  );
  const historyClaims = useMemo(
    () => (claims ?? []).filter((c) => c.status !== "pending"),
    [claims],
  );

  // Reorder is all-or-nothing: submit the full ordered list of pending claim ids.
  const movePending = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= pendingClaims.length) return;
    const next = [...pendingClaims];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((c) => c.id));
  };

  const handleSubmit = async (dropPlayerId: string) => {
    if (!addTarget) return;
    try {
      await submit.mutateAsync({ addPlayerId: addTarget.id, dropPlayerId });
      setAddTarget(null);
    } catch {
      // shared mutation toast surfaces the error
    }
  };

  if (!isDraftMode) {
    return (
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#f0f0f0]">
        <NavigationTabs activeTab="waivers" leagueId={leagueId} isCommissioner={isCommissioner} />
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-8 text-center text-sm text-[#555560]">
          Waivers are only available in draft leagues.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5 px-6 py-8 text-[#f0f0f0]">
      <NavigationTabs activeTab="waivers" leagueId={leagueId} isCommissioner={isCommissioner} />

      <header className="border-b border-[rgba(255,255,255,0.08)] pb-4">
        <p className="section-label">{league?.name || "League"}</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#f0f0f0] sm:text-6xl">
          Waiver Wire
        </h1>
        <p className="mt-1 text-sm text-[#555560]">
          Claims are resolved in waiver order before the next gameweek. Win one and
          you drop to the back of the queue.
        </p>
      </header>

      {!isActive ? (
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6 text-sm text-[#9a9aa5]">
          Waivers open once the season is active.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left: submit a claim from the pool */}
          <div className="space-y-3 lg:col-span-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search available players…"
              className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-2.5 text-sm text-[#f0f0f0] outline-none transition-colors focus:border-[#e8fb25]"
            />
            {(filteredPool.length ?? 0) === 0 ? (
              <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-8 text-center text-sm text-[#555560]">
                No available players.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredPool.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <PlayerAvatar name={p.name} photoUrl={p.photo_url} size="sm" className="shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                          {p.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#555560]">
                          <span>{p.position}</span>
                          {p.real_team ? (
                            <>
                              <span className="text-[#33333a]">·</span>
                              <TeamLogo teamName={p.real_team} logoUrl={p.real_team_logo_url} size="sm" />
                              <span>{p.real_team}</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddTarget(p)}
                      className="shrink-0 rounded-[3px] border border-[rgba(232,251,37,0.4)] px-3 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#e8fb25] transition-colors hover:bg-[rgba(232,251,37,0.08)]"
                    >
                      Claim
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: waiver order + my pending claims */}
          <div className="space-y-5 lg:col-span-1">
            <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
              <span className="section-label">Waiver Order</span>
              <ol className="mt-3 space-y-1.5">
                {(order ?? []).map((o) => (
                  <li key={o.fantasy_team_id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-[#555560] tabular-nums">{o.position}.</span>
                    <span className="truncate text-[#f0f0f0]">{o.team_name}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
              <span className="section-label">My Claims</span>
              {claimsLoading ? (
                <CardSkeleton />
              ) : (claims?.length ?? 0) === 0 ? (
                <p className="mt-3 text-sm text-[#555560]">No claims yet.</p>
              ) : (
                <>
                  {pendingClaims.length > 0 ? (
                    <>
                      <p className="mt-3 text-[10px] uppercase tracking-[1px] text-[#555560]">
                        Pending — processed top to bottom
                      </p>
                      <ul className="mt-1.5 space-y-2">
                        {pendingClaims.map((c, i) => (
                          <li
                            key={c.id}
                            className="rounded-[3px] border border-[rgba(255,255,255,0.06)] bg-[#0d0d12] p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={i === 0 || reorder.isPending}
                                  onClick={() => movePending(i, -1)}
                                  className="flex h-8 w-8 items-center justify-center rounded-[3px] text-[#9a9aa5] transition-colors hover:text-[#e8fb25] disabled:opacity-30"
                                  aria-label="Move up"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={i === pendingClaims.length - 1 || reorder.isPending}
                                  onClick={() => movePending(i, 1)}
                                  className="flex h-8 w-8 items-center justify-center rounded-[3px] text-[#9a9aa5] transition-colors hover:text-[#e8fb25] disabled:opacity-30"
                                  aria-label="Move down"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </button>
                                <span className="ml-1 text-[#555560] tabular-nums">
                                  #{i + 1}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => cancel.mutate(c.id)}
                                className="text-[#ff3b30] hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="mt-1 text-[#9a9aa5]">
                              <span className="text-[#4caf50]">IN</span>{" "}
                              {nameById.get(c.add_player_id) ?? "Player"} ·{" "}
                              <span className="text-[#ff8a8a]">OUT</span>{" "}
                              {nameById.get(c.drop_player_id) ?? "Player"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {historyClaims.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {historyClaims.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-[3px] border border-[rgba(255,255,255,0.06)] bg-[#0d0d12] p-2.5 text-xs"
                        >
                          <span
                            className="font-barlow-condensed font-700 uppercase tracking-[1px]"
                            style={{ color: STATUS_COLORS[c.status] ?? "#9a9aa5" }}
                          >
                            {c.status}
                          </span>
                          <p className="mt-1 text-[#9a9aa5]">
                            <span className="text-[#4caf50]">IN</span>{" "}
                            {nameById.get(c.add_player_id) ?? "Player"} ·{" "}
                            <span className="text-[#ff8a8a]">OUT</span>{" "}
                            {nameById.get(c.drop_player_id) ?? "Player"}
                          </p>
                          {c.failure_reason ? (
                            <p className="mt-1 text-[#ff8a8a]">{c.failure_reason}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(addTarget)}
        onClose={() => setAddTarget(null)}
        closeDisabled={submit.isPending}
      >
        <p className="section-label">Claim {addTarget?.name}</p>
        <h3 className="mt-1 font-barlow-condensed text-lg font-700 uppercase tracking-[1px] text-[#f0f0f0]">
          Drop a player if you win
        </h3>
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {dropCandidates.length === 0 ? (
            <p className="text-sm text-[#555560]">
              No droppable {addTarget?.sport} players on your squad.
            </p>
          ) : (
            dropCandidates.map((tp) => (
              <button
                key={tp.player.id}
                type="button"
                disabled={submit.isPending}
                onClick={() => handleSubmit(tp.player.id)}
                className="flex w-full items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-2.5 text-left transition-colors hover:border-[rgba(232,251,37,0.4)] disabled:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <PlayerAvatar name={tp.player.name} photoUrl={tp.player.photo_url} size="sm" />
                  <span className="truncate text-sm text-[#f0f0f0]">{tp.player.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-[#555560]">
                  <span>{tp.player.position}</span>
                  {tp.player.real_team ? (
                    <>
                      <span className="text-[#33333a]">·</span>
                      <TeamLogo teamName={tp.player.real_team} logoUrl={tp.player.real_team_logo_url} size="sm" />
                      <span>{tp.player.real_team}</span>
                    </>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => setAddTarget(null)}
          disabled={submit.isPending}
          className="mt-4 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:text-[#f0f0f0] disabled:opacity-50"
        >
          Cancel
        </button>
      </Modal>
    </section>
  );
}
