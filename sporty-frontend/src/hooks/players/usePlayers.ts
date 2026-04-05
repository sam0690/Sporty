import { useApiQuery } from "../api/useApiQuery";
import { PlayerService } from "@/services/PlayerService";
import type { TPlayerFilter } from "@/types";

export const usePlayers = (filters: TPlayerFilter = {}) => {
    return useApiQuery(["players", "list", JSON.stringify(filters)], () =>
        PlayerService.getPlayers(filters)
    );
};

export const usePlayer = (id: string) => {
    return useApiQuery(["players", "detail", id], () => PlayerService.getPlayer(id), {
        enabled: !!id,
    });
};

export const usePlayerStats = (id: string, windowId: string) => {
    return useApiQuery(
        ["players", id, "stats", windowId],
        () => PlayerService.getPlayerStats(id, windowId),
        {
            enabled: !!id && !!windowId,
        }
    );
};
