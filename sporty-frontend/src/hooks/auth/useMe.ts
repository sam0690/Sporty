import { useApiQuery } from "@/hooks/api/useApiQuery";
import { UserService, type TMe } from "@/services/UserService";

export function useMe() {
  const query = useApiQuery<TMe>(["auth", "me"], () => UserService.me());

  return {
    ...query,
    username: query.data?.username ?? "",
  };
}
