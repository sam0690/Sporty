/**
 * Live draft — start, picks, turn polling.
 *
 * Split from the former 848-line useLeagues.ts; that file re-exports
 * everything, so existing imports keep working.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "../api/useApiQuery";
import { useApiMutation } from "../api/useApiMutation";
import { LeagueService } from "@/services/LeagueService";
import { TDraftPick, TDraftTurn } from "@/types";


export const useStartDraft = () => {
  const queryClient = useQueryClient();
  return useApiMutation((id: string) => LeagueService.startDraft(id), {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["leagues", id] });
      queryClient.invalidateQueries({ queryKey: ["leagues", id, "my-team"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
    successMessage: "Draft started!",
  });
};

export const useMakeDraftPick = (leagueId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation<TDraftPick, string>(
    (playerId: string) => LeagueService.makeDraftPick(leagueId, playerId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "my-team"],
        });
        queryClient.invalidateQueries({ queryKey: ["players"] });
      },
      successMessage: "Draft pick submitted!",
    },
  );
};

export const useDraftTurn = (leagueId: string, enabled = true) => {
  return useApiQuery<TDraftTurn>(
    ["leagues", leagueId, "draft-turn"],
    () => LeagueService.getDraftTurn(leagueId),
    {
      enabled: !!leagueId && enabled,
      refetchInterval: 3000,
    },
  );
};
