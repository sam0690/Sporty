import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import {
  UserService,
  type TUserActivityItem,
  type TUserProfile,
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
    (payload: { username?: string; avatar_url?: string | null }) =>
      UserService.updateUser(userId, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["users", userId] });
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      },
      successMessage: "Profile updated",
    },
  );
}

export function useUserActivity(userId: string) {
  return useApiQuery<TUserActivityItem[]>(
    ["users", userId, "activity"],
    () => UserService.getUserActivity(userId),
    { enabled: !!userId },
  );
}
