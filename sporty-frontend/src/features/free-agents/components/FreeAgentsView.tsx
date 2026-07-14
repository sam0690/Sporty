"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { CardSkeleton } from "@/components/ui/skeletons";
import {
  ErrorState,
  Modal,
  PlayerAvatar,
  PlayerListCard,
  Select,
  TeamLogo,
} from "@/components/ui";
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

  const { data: league } = useLeague(leagueId);
  const { isDraftMode } = useLeagueCompetitionMode(league);
  const { data: myTeam } = useMyTeam(leagueId);

  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [addTarget, setAddTarget] = useState<TFreeAgent | null>(null);

  const isActive = league?.status === "active";

  const { data, isLoading, isError } = useFreeAgents(
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
      <section className="space-y-6">
        <div className="card-surface p-8 text-center text-sm text-fg-3">
          Free agents are only available in draft leagues.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <header className="border-b border-white/8 pb-4">
        <p className="section-label">{league?.name || "League"}</p>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
          Free Agents
        </h1>
        <p className="mt-1 text-sm text-fg-3">
          Add an unowned player and drop one of your own to make room.
        </p>
      </header>

      {!isActive ? (
        <div className="card-surface p-6 text-sm text-fg-2">
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
              className="w-full rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-sm text-fg-1 outline-none transition-colors focus:border-accent"
            />
            <Select
              value={position}
              onChange={setPosition}
              aria-label="Filter by position"
              options={[
                { value: "", label: "All positions" },
                ...positions.map((p) => ({ value: p, label: p })),
              ]}
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : isError ? (
            <ErrorState title="Failed to load free agents" />
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="card-surface p-8 text-center text-sm text-fg-3">
              No available free agents match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data!.items.map((p) => (
                <PlayerListCard
                  key={p.id}
                  player={{
                    id: p.id,
                    name: p.name,
                    photoUrl: p.photo_url,
                    position: p.position,
                    realTeam: p.real_team,
                    realTeamLogoUrl: p.real_team_logo_url,
                    sport: p.sport,
                  }}
                  actionLabel="Add"
                  onAction={() => setAddTarget(p)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={Boolean(addTarget)}
        onClose={() => setAddTarget(null)}
        closeDisabled={claim.isPending}
      >
        <p className="section-label">Add {addTarget?.name}</p>
        <h3 className="mt-1 font-sans text-lg font-700 uppercase tracking-[1px] text-fg-1">
          Drop a player to make room
        </h3>
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {dropCandidates.length === 0 ? (
            <p className="text-sm text-fg-3">
              No droppable {addTarget?.sport} players on your squad.
            </p>
          ) : (
            dropCandidates.map((tp) => (
              <button
                key={tp.player.id}
                type="button"
                disabled={claim.isPending}
                onClick={() => handleConfirmDrop(tp.player.id)}
                className="flex w-full items-center justify-between rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-left transition-colors hover:border-[rgba(255,59,48,0.4)] disabled:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <PlayerAvatar name={tp.player.name} photoUrl={tp.player.photo_url} size="sm" />
                  <span className="truncate text-sm text-fg-1">{tp.player.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-fg-3">
                  <span>{tp.player.position}</span>
                  {tp.player.real_team ? (
                    <>
                      <span className="text-white/20">·</span>
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
          disabled={claim.isPending}
          className="mt-4 w-full rounded-[3px] border border-white/8 bg-transparent px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-fg-3 transition-colors hover:text-fg-1 disabled:opacity-50"
        >
          Cancel
        </button>
      </Modal>
    </section>
  );
}
