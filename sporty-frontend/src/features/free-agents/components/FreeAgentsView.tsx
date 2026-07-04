"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { CardSkeleton } from "@/components/ui/skeletons";
import { PlayerAvatar, TeamLogo } from "@/components/ui";
import { useMe } from "@/hooks/auth/useMe";
import {
  useClaimFreeAgent,
  useFreeAgents,
  useLeague,
  useMyTeam,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import type { TFreeAgent, TTeamPlayer } from "@/types";

export function FreeAgentsView() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const { username } = useMe();
  const { data: league } = useLeague(leagueId);
  const { isDraftMode } = useLeagueCompetitionMode(league);
  const { data: myTeam } = useMyTeam(leagueId);
  const isCommissioner = league?.owner?.username === username;

  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [addTarget, setAddTarget] = useState<TFreeAgent | null>(null);

  const isActive = league?.status === "active";

  const { data, isLoading } = useFreeAgents(
    leagueId,
    { search: search.trim() || undefined, position: position || undefined, limit: 50 },
    isDraftMode && isActive,
  );
  const claim = useClaimFreeAgent(leagueId);

  const squad: TTeamPlayer[] = useMemo(
    () => myTeam?.players ?? myTeam?.team_players ?? [],
    [myTeam],
  );

  // Multisport: you can only drop a player of the same sport you're adding.
  const dropCandidates = useMemo(() => {
    if (!addTarget) return [];
    return squad.filter((tp) => tp.player.sport.name === addTarget.sport);
  }, [squad, addTarget]);

  const positions = useMemo(() => {
    const set = new Set<string>();
    (data?.items ?? []).forEach((p) => set.add(p.position));
    return Array.from(set).sort();
  }, [data]);

  const handleConfirmDrop = async (dropPlayerId: string) => {
    if (!addTarget) return;
    try {
      await claim.mutateAsync({
        addPlayerId: addTarget.id,
        dropPlayerId,
      });
      setAddTarget(null);
    } catch {
      // shared mutation toast surfaces the error
    }
  };

  if (!isDraftMode) {
    return (
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#f0f0f0]">
        <NavigationTabs
          activeTab="free-agents"
          leagueId={leagueId}
          isCommissioner={isCommissioner}
        />
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-8 text-center text-sm text-[#555560]">
          Free agents are only available in draft leagues.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5 px-6 py-8 text-[#f0f0f0]">
      <NavigationTabs
        activeTab="free-agents"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <header className="border-b border-[rgba(255,255,255,0.08)] pb-4">
        <p className="section-label">{league?.name || "League"}</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#f0f0f0] sm:text-6xl">
          Free Agents
        </h1>
        <p className="mt-1 text-sm text-[#555560]">
          Add an unowned player and drop one of your own to make room.
        </p>
      </header>

      {!isActive ? (
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6 text-sm text-[#9a9aa5]">
          Free agents open once the season is active.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players…"
              className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-2.5 text-sm text-[#f0f0f0] outline-none transition-colors focus:border-[#e8fb25]"
            />
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-2.5 text-sm text-[#f0f0f0] outline-none focus:border-[#e8fb25]"
              style={{ colorScheme: "dark" }}
            >
              <option value="">All positions</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-8 text-center text-sm text-[#555560]">
              No available free agents match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data!.items.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative shrink-0">
                      <PlayerAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                      {p.real_team ? (
                        <TeamLogo
                          teamName={p.real_team}
                          logoUrl={p.real_team_logo_url}
                          size="sm"
                          className="absolute -bottom-1 -right-1 border-2 border-[#111117]"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                        {p.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[#555560]">
                        {p.position} · {p.real_team} · {p.sport}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddTarget(p)}
                    className="shrink-0 rounded-[3px] bg-[#e8fb25] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#f2ff5a]"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {addTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !claim.isPending) setAddTarget(null);
          }}
        >
          <div className="w-full max-w-md rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6">
            <p className="section-label">Add {addTarget.name}</p>
            <h3 className="mt-1 font-barlow-condensed text-lg font-700 uppercase tracking-[1px] text-[#f0f0f0]">
              Drop a player to make room
            </h3>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {dropCandidates.length === 0 ? (
                <p className="text-sm text-[#555560]">
                  No droppable {addTarget.sport} players on your squad.
                </p>
              ) : (
                dropCandidates.map((tp) => (
                  <button
                    key={tp.player.id}
                    type="button"
                    disabled={claim.isPending}
                    onClick={() => handleConfirmDrop(tp.player.id)}
                    className="flex w-full items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-2.5 text-left transition-colors hover:border-[rgba(255,59,48,0.4)] disabled:opacity-50"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerAvatar name={tp.player.name} photoUrl={tp.player.photo_url} size="sm" />
                      <span className="truncate text-sm text-[#f0f0f0]">{tp.player.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-[#555560]">
                      {tp.player.position} · {tp.player.real_team}
                    </span>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => setAddTarget(null)}
              disabled={claim.isPending}
              className="mt-4 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:text-[#f0f0f0] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
