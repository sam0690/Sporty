"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Trash2 } from "lucide-react";

import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { useMe } from "@/hooks/auth/useMe";
import { useLeague } from "@/hooks/leagues/useLeagues";
import {
  useChatMessages,
  useDeleteChatMessage,
  usePostChatMessage,
  useToggleChatReaction,
} from "@/hooks/leagues/useLeagueChat";
import { useLeagueChatSocket } from "@/hooks/leagues/useLeagueChatSocket";
import type { TChatMessage } from "@/types";

const REACTION_EMOJIS = ["👍", "🔥", "😂", "😢", "😮", "❤️"];
const MAX_MESSAGE_LENGTH = 1000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ReactionBar({
  message,
  onToggle,
}: {
  message: TChatMessage;
  onToggle: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {message.reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => onToggle(reaction.emoji)}
          aria-pressed={reaction.reacted_by_me}
          className={`flex min-h-[28px] items-center gap-1 rounded-[3px] border px-2 py-0.5 text-xs transition-colors ${
            reaction.reacted_by_me
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-white/8 bg-surface-3 text-fg-2 hover:text-fg-1"
          }`}
        >
          <span aria-hidden>{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={pickerOpen}
          aria-label="Add reaction"
          className="flex h-7 min-w-[28px] items-center justify-center rounded-[3px] border border-white/8 bg-surface-3 px-1.5 text-xs text-fg-2 transition-colors hover:text-fg-1"
        >
          +
        </button>
        {pickerOpen ? (
          <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 card-surface p-1.5 shadow-xl">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(emoji);
                  setPickerOpen(false);
                }}
                aria-label={`React with ${emoji}`}
                className="flex h-8 w-8 items-center justify-center rounded-[3px] text-base transition-colors hover:bg-surface-3"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function LeagueChat() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const { username } = useMe();
  const { data: league } = useLeague(leagueId);
  const isCommissioner = league?.owner?.username === username;

  const { data: messages, isLoading } = useChatMessages(leagueId);
  const postMessage = usePostChatMessage(leagueId);
  const deleteMessage = useDeleteChatMessage(leagueId);
  const toggleReaction = useToggleChatReaction(leagueId);
  useLeagueChatSocket(leagueId);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || postMessage.isPending) return;
    try {
      await postMessage.mutateAsync(body);
      setDraft("");
    } catch {
      // shared mutation toast surfaces the error
    }
  };

  return (
    <section className="mx-auto max-w-4xl space-y-5 px-6 py-8 text-fg-1">
      <NavigationTabs activeTab="chat" leagueId={leagueId} isCommissioner={isCommissioner} />

      <header className="border-b border-white/8 pb-4">
        <p className="section-label">{league?.name || "League"}</p>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
          Chat
        </h1>
      </header>

      <div className="flex h-[60vh] min-h-[420px] flex-col overflow-hidden card-surface">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {isLoading ? (
            <p className="text-sm text-fg-3">Loading messages…</p>
          ) : !messages || messages.length === 0 ? (
            <p className="text-sm text-fg-3">
              No messages yet — say hello to your league.
            </p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <PlayerAvatar
                  name={message.user.username}
                  photoUrl={message.user.avatar_url}
                  size="sm"
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-sans text-sm font-700 uppercase tracking-[1px] text-fg-1">
                      {message.user.username}
                    </span>
                    <span className="text-xs text-fg-3">
                      {formatTime(message.created_at)}
                    </span>
                    {message.can_delete ? (
                      <button
                        type="button"
                        onClick={() => deleteMessage.mutate(message.id)}
                        aria-label="Delete message"
                        className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-fg-3 transition-colors hover:text-danger"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[#d0d0d5]">
                    {message.body}
                  </p>
                  <ReactionBar
                    message={message}
                    onToggle={(emoji) =>
                      toggleReaction.mutate({ messageId: message.id, emoji })
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/8 p-3">
          <label htmlFor="chat-message-input" className="sr-only">
            Message
          </label>
          <input
            id="chat-message-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Message your league…"
            className="min-h-[44px] flex-1 rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-sm text-fg-1 outline-none transition-colors focus:border-accent"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || postMessage.isPending}
            className="min-h-[44px] rounded-[3px] bg-accent px-5 font-sans text-xs font-700 uppercase tracking-[1.5px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
