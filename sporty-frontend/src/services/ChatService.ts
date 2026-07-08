import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { TChatMessage } from "@/types";

export const ChatService = {
  /** Most recent messages in a league's chat, oldest first */
  async listMessages(leagueId: string, limit = 50): Promise<TChatMessage[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.CHAT_MESSAGES(leagueId), {
      params: { limit },
    });
    return res.data;
  },

  async postMessage(leagueId: string, body: string): Promise<TChatMessage> {
    const res = await authApi.post(API_PATHS.LEAGUES.CHAT_MESSAGES(leagueId), {
      body,
    });
    return res.data;
  },

  async deleteMessage(leagueId: string, messageId: string): Promise<void> {
    await authApi.delete(
      API_PATHS.LEAGUES.CHAT_MESSAGE_DETAIL(leagueId, messageId),
    );
  },

  async toggleReaction(
    leagueId: string,
    messageId: string,
    emoji: string,
  ): Promise<TChatMessage> {
    const res = await authApi.post(
      API_PATHS.LEAGUES.CHAT_MESSAGE_REACTIONS(leagueId, messageId),
      { emoji },
    );
    return res.data;
  },
};
