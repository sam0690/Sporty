import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import {
  UserService,
  type TUserActivityItem,
  type TUserProfile,
  type TUserPublicStats,
  type TUsersListResponse,
} from "@/services/UserService";

export function useUsers(page = 1, pageSize = 20) {
  return useApiQuery<TUsersListResponse>(["users", page, pageSize], () =>
    UserService.listUsers({ page, page_size: pageSize }),
  );
}

export function useUser(userId: string) {
  return useApiQuery<TUserProfile>(
    ["users", userId],
    () => UserService.getUser(userId),
    { enabled: !!userId },
  );
}

export function useUpdateUser(userId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (payload: {
      username?: string;
      avatar_url?: string | null;
      email_notifications_enabled?: boolean;
    }) => UserService.updateUser(userId, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["users", userId] });
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      },
      successMessage: "Profile updated",
    },
  );
}

function useFavouritesInvalidation(userId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["users", userId] });
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  };
}

export function useSetFavouriteTeam(userId: string) {
  const invalidate = useFavouritesInvalidation(userId);
  return useApiMutation(
    ({ sportName, teamId }: { sportName: string; teamId: string }) =>
      UserService.setFavouriteTeam(sportName, teamId),
    { onSuccess: invalidate, successMessage: "Favourite team updated" },
  );
}

export function useRemoveFavouriteTeam(userId: string) {
  const invalidate = useFavouritesInvalidation(userId);
  return useApiMutation(
    (sportName: string) => UserService.removeFavouriteTeam(sportName),
    { onSuccess: invalidate, successMessage: "Favourite team removed" },
  );
}

export function useSetFavouritePlayer(userId: string) {
  const invalidate = useFavouritesInvalidation(userId);
  return useApiMutation(
    ({ sportName, playerId }: { sportName: string; playerId: string }) =>
      UserService.setFavouritePlayer(sportName, playerId),
    { onSuccess: invalidate, successMessage: "Favourite player updated" },
  );
}

export function useRemoveFavouritePlayer(userId: string) {
  const invalidate = useFavouritesInvalidation(userId);
  return useApiMutation(
    (sportName: string) => UserService.removeFavouritePlayer(sportName),
    { onSuccess: invalidate, successMessage: "Favourite player removed" },
  );
}

export function useUploadAvatar(userId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (file: File) => UserService.uploadAvatar(userId, file),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["users", userId] });
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      },
      successMessage: "Avatar updated",
    },
  );
}

export function useUserPublicStats(userId: string) {
  return useApiQuery<TUserPublicStats>(
    ["users", userId, "public-stats"],
    () => UserService.getUserPublicStats(userId),
    { enabled: !!userId },
  );
}

/** Username-keyed variant — powers the /user/{username} profile route. */
export function useUserPublicStatsByUsername(username: string) {
  return useApiQuery<TUserPublicStats>(
    ["users", "by-username", username, "public-stats"],
    () => UserService.getUserPublicStatsByUsername(username),
    { enabled: !!username },
  );
}

/** No-auth variant for the shareable /u/[username] manager-profile page. */
export function usePublicManagerStats(userId: string) {
  return useApiQuery<TUserPublicStats>(
    ["users", "public", userId, "stats"],
    () => UserService.getPublicManagerStats(userId),
    { enabled: !!userId },
  );
}

export function usePublicManagerStatsByUsername(username: string) {
  return useApiQuery<TUserPublicStats>(
    ["users", "public", "by-username", username, "stats"],
    () => UserService.getPublicManagerStatsByUsername(username),
    { enabled: !!username },
  );
}

export function useUserActivity(userId: string) {
  return useApiQuery<TUserActivityItem[]>(
    ["users", userId, "activity"],
    () => UserService.getUserActivity(userId),
    { enabled: !!userId },
  );
}
