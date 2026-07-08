import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { ChatService } from "@/services/ChatService";
import type { TChatMessage } from "@/types";

const chatQueryKey = (leagueId: string) => ["leagues", leagueId, "chat", "messages"];

export function useChatMessages(leagueId: string, enabled = true) {
  return useApiQuery<TChatMessage[]>(
    chatQueryKey(leagueId),
    () => ChatService.listMessages(leagueId),
    { enabled: !!leagueId && enabled },
  );
}

export function usePostChatMessage(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TChatMessage, string>(
    (body) => ChatService.postMessage(leagueId, body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: chatQueryKey(leagueId) });
      },
    },
  );
}

export function useDeleteChatMessage(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<void, string>(
    (messageId) => ChatService.deleteMessage(leagueId, messageId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: chatQueryKey(leagueId) });
      },
    },
  );
}

export function useToggleChatReaction(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TChatMessage, { messageId: string; emoji: string }>(
    ({ messageId, emoji }) => ChatService.toggleReaction(leagueId, messageId, emoji),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: chatQueryKey(leagueId) });
      },
    },
  );
}

export { chatQueryKey };
