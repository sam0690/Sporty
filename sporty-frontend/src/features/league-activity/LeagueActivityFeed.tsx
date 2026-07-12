"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  ClipboardList,
  Inbox,
  Trophy,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { EmptyState, ErrorState } from "@/components/ui";
import { useLeague } from "@/hooks/leagues/useLeagues";
import { useLeagueActivity } from "@/hooks/leagues/useLeagueActivity";
import { LeagueActivityService } from "@/services/LeagueActivityService";
import { useRelativeTime } from "@/hooks/general/useRelativeTime";
import { formatRelativeTime } from "@/utils/dateUtils";
import { useParams } from "next/navigation";
import type { TLeagueActivityEvent } from "@/types";

const ACTIVITY_META: Record<
  TLeagueActivityEvent["type"],
  { Icon: LucideIcon; color: string; label: string }
> = {
  trade: { Icon: ArrowLeftRight, color: "#e2c368", label: "Trade" },
  waiver: { Icon: Inbox, color: "#00d4ff", label: "Waiver Claim" },
  free_agent: { Icon: UserPlus, color: "#9b59b6", label: "Free Agent Pickup" },
  dynasty_carryover: { Icon: Trophy, color: "#ffd86b", label: "Dynasty Carryover" },
  draft_pick: { Icon: ClipboardList, color: "#00e07f", label: "Draft Pick" },
  transfer: { Icon: ArrowLeftRight, color: "#e2c368", label: "Transfer" },
};

function describeEvent(event: TLeagueActivityEvent): string {
  const team = event.fantasy_team.name;
  const add = event.add_player?.name;
  const drop = event.drop_player?.name;

  switch (event.type) {
    case "trade":
      return `${team} acquired ${add ?? "a player"} via trade`;
    case "waiver":
      return drop
        ? `${team} won a waiver claim, swapping ${drop} for ${add}`
        : `${team} won a waiver claim for ${add ?? "a player"}`;
    case "free_agent":
      return drop
        ? `${team} swapped ${drop} for free agent ${add}`
        : `${team} picked up free agent ${add ?? "a player"}`;
    case "dynasty_carryover":
      return `${team} carried over ${add ?? "a player"} into the new season`;
    case "draft_pick":
      return `${team} drafted ${add ?? "a player"}${
        event.round_number != null && event.pick_number != null
          ? ` (Round ${event.round_number}, Pick ${event.pick_number})`
          : ""
      }`;
    case "transfer":
      return `${team} transferred ${drop ?? "a player"} for ${add ?? "a player"}`;
    default:
      return `${team} made a roster move`;
  }
}

export function LeagueActivityFeed() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id || "";
  const { data: league } = useLeague(leagueId);
  const nowMs = useRelativeTime({ refreshIntervalMs: 60_000 });

  const PAGE_SIZE = 50;
  const { data, isLoading, isError } = useLeagueActivity(leagueId);
  const [olderEvents, setOlderEvents] = useState<TLeagueActivityEvent[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Only the most recently fetched page's size tells us whether there's
  // more — a short page (< PAGE_SIZE) means we've hit the end.
  const [lastPageSize, setLastPageSize] = useState<number | null>(null);

  const events = [...(data ?? []), ...olderEvents];
  const initialPageSize = data?.length ?? null;
  const hasMore = (lastPageSize ?? initialPageSize ?? PAGE_SIZE) >= PAGE_SIZE;

  const handleLoadMore = async () => {
    const last = events[events.length - 1];
    if (!last) return;
    setIsLoadingMore(true);
    try {
      const next = await LeagueActivityService.list(leagueId, {
        limit: PAGE_SIZE,
        before: last.created_at,
      });
      setOlderEvents((prev) => [...prev, ...next]);
      setLastPageSize(next.length);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-6 py-8 text-fg-1">
      <p className="section-label">{league?.name || "League"}</p>
      <h1 className="font-sans text-sm font-700 uppercase tracking-[2px] text-fg-1">
        League Activity
      </h1>

      <div className="card-surface px-5">
        {isLoading ? (
          <div className="space-y-3 py-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="skeleton h-11 rounded-[3px]" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState className="my-5" title="Failed to load activity" />
        ) : events.length === 0 ? (
          <EmptyState
            className="my-5 !border-transparent !bg-transparent !py-8 !shadow-none"
            icon={Inbox}
            title="No activity yet"
            description="Trades, waivers, and draft picks will show up here."
          />
        ) : (
          <>
            <ul className="divide-y divide-white/6">
              {events.map((event) => {
                const meta = ACTIVITY_META[event.type];
                const Icon = meta.Icon;
                return (
                  <li key={event.id} className="group flex items-start gap-3 py-3.5">
                    <Icon
                      className="mt-0.5 size-4 shrink-0"
                      style={{ color: meta.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="section-label text-fg-3">{meta.label}</p>
                        <span className="shrink-0 section-label whitespace-nowrap text-fg-3 transition-colors group-hover:text-fg-2">
                          {formatRelativeTime(event.created_at, nowMs)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-fg-1">{describeEvent(event)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {hasMore ? (
              <div className="flex justify-center py-4">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="rounded-[3px] border border-white/12 bg-surface-2 px-4 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:border-white/25 hover:text-fg-1 disabled:opacity-50"
                >
                  {isLoadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
