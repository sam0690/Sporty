"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import {
  useLeague,
  useActiveWindow,
  useEditableWindow,
  useDraftTurn,
  useMakeDraftPick,
  useMyTeam,
} from "@/hooks/leagues/useLeagues";
import { useDraftRoomStream } from "@/hooks/leagues/useLeagueDraftStream";
import {
  buildSquadValidation,
  clubWarnings,
  normalizeLeagueSport,
  SQUAD_SIZES,
} from "@/lib/squad/squadRules";
import type { MarketPlayer } from "../components/PlayerCard";
import { toMarketPlayer, usePlayerMarket } from "./usePlayerMarket";

/**
 * Everything the live draft room needs, and nothing the budget team builder
 * needs: draft turn polling + SSE push, pick submission, roster/draft
 * completion, and the draft-side squad checklist. Split out of the old
 * 710-line useCreateTeamDashboard so budget leagues don't run draft queries
 * and vice versa.
 */
export function useDraftRoom() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { username, data: me } = useMe();
  const leagueId = params?.id ?? "";

  const { data: league } = useLeague(leagueId);
  const { data: myTeam } = useMyTeam(leagueId);

  const hasTeam = !!myTeam;
  const { data: activeWindow } = useActiveWindow(leagueId, {
    enabled: !!leagueId && hasTeam,
  });
  const { data: editableWindow } = useEditableWindow(leagueId, {
    enabled: !!leagueId && hasTeam,
  });

  const leagueSport = normalizeLeagueSport(league?.sports);
  const requiredPlayers = SQUAD_SIZES[leagueSport];
  const rawBudget = Number(league?.budget_per_team ?? 103);
  const budget = Number.isFinite(rawBudget) ? rawBudget : 103;

  const market = usePlayerMarket(leagueId);

  const makeDraftPickMutation = useMakeDraftPick(leagueId);
  const draftRoomEnabled = !!leagueId && league?.status === "drafting";
  const { data: draftTurn } = useDraftTurn(leagueId, draftRoomEnabled);
  // Live pick/turn push over SSE; useDraftTurn's poll stays on as a fallback
  // for a missed SSE frame.
  const { lastPick: lastDraftPick } = useDraftRoomStream(
    leagueId,
    draftRoomEnabled,
  );

  const [error, setError] = useState<string | null>(null);

  const draftedPlayers: MarketPlayer[] = useMemo(() => {
    const rows = myTeam?.team_players ?? myTeam?.players ?? [];
    return rows.map((row) =>
      toMarketPlayer({
        id: row.player.id,
        display_name: row.player.name,
        sport: row.player.sport,
        position: row.player.position,
        real_team: row.player.real_team,
        photo_url: row.player.photo_url,
        real_team_logo_url: row.player.real_team_logo_url,
        current_cost: row.player.cost,
      }),
    );
  }, [myTeam]);

  // Draft picks have no cost cap, so the checklist skips the budget rule.
  const squadValidation = useMemo(
    () =>
      buildSquadValidation({
        players: draftedPlayers,
        leagueSport,
        includeBudgetRule: false,
        remainingBudget: Number(myTeam?.current_budget ?? budget),
        positionMinimums: league?.position_minimums ?? {},
      }),
    [draftedPlayers, leagueSport, myTeam?.current_budget, budget, league?.position_minimums],
  );
  const clubCounts = useMemo(
    () => clubWarnings(draftedPlayers, league?.max_per_club),
    [draftedPlayers, league?.max_per_club],
  );

  // In a snake draft every manager finishes with a full squad at the same
  // last pick, so "roster full" and "draft complete" coincide — either is a
  // safe signal to surface the finish CTA.
  const isRosterComplete = draftedPlayers.length >= requiredPlayers;
  const isDraftComplete = Boolean(draftTurn?.is_draft_complete);

  const isMyDraftTurn =
    league?.status === "drafting" &&
    !!draftTurn?.current_turn_user_id &&
    !!me?.id &&
    String(draftTurn.current_turn_user_id) === String(me.id);

  const handleDraftPick = async (player: MarketPlayer) => {
    if (!leagueId) return;
    setError(null);
    if (!isMyDraftTurn) {
      setError("It is not your turn to pick yet.");
      return;
    }
    try {
      await makeDraftPickMutation.mutateAsync(String(player.id));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to submit draft pick",
      );
    }
  };

  const handleGoToLineup = useCallback(() => {
    if (!leagueId) return;
    router.push(`/leagues/${leagueId}/lineup`);
  }, [leagueId, router]);

  return {
    username,
    router,
    league,
    myTeam,
    leagueSport,
    budget,
    requiredPlayers,
    error,
    draftedPlayers,
    squadValidation,
    clubCounts,
    isRosterComplete,
    isDraftComplete,
    isMyDraftTurn,
    handleDraftPick,
    handleGoToLineup,
    activeWindow,
    editableWindow,
    draftTurn,
    lastDraftPick,
    makeDraftPickMutation,
    ...market,
  } as const;
}

export type DraftRoomState = ReturnType<typeof useDraftRoom>;
