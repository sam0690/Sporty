"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Carousel } from "@mantine/carousel";
import { PlayerAvatar, TeamLogo } from "@/components/ui";
import type { TUserTransferLeagueGroup } from "@/types";

type UserTransferHistoryCarouselProps = {
  groups: TUserTransferLeagueGroup[];
  isLoading: boolean;
  isError: boolean;
};

const sportIconByName: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

const sportAccentByName: Record<string, string> = {
  football: "#00e07f",
  basketball: "#ff6b35",
  cricket: "#00d4ff",
};

function formatMoney(value: number | string | undefined): string {
  const numericValue = Number(value ?? 0);
  if (Number.isNaN(numericValue)) {
    return "0.00";
  }
  return numericValue.toFixed(2);
}

function resolvePlayerName(player: {
  name?: string;
  display_name?: string;
}): string {
  return player.name || player.display_name || "Unknown Player";
}

function formatTransferTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString();
}

export function UserTransferHistoryCarousel({
  groups,
  isLoading,
  isError,
}: UserTransferHistoryCarouselProps) {
  return (
    <section className="overflow-hidden card-surface">
      <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
        <p className="section-label">Your Transfer History</p>
        <span className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
          Grouped by league
        </span>
      </div>

      <div className="p-6">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-[3px] bg-surface-3"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] p-4 text-sm text-danger-soft">
          Could not load your transfer history.
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-[3px] border border-white/8 bg-surface-3 p-6 text-center text-sm text-fg-3">
          No transfers yet. Once you confirm moves, they will appear here.
        </div>
      ) : (
        <Carousel
          withIndicators
          slideSize="100%"
          slideGap="md"
          emblaOptions={{ loop: groups.length > 1, align: "start" }}
        >
          {groups.map((group) => {
            const sportBadges = (group.league.sports ?? []).map(
              (leagueSport) => {
                const sportName = leagueSport.sport.name;
                const accent = sportAccentByName[sportName] ?? "#a0a0aa";
                return (
                  <span
                    key={`${group.league.id}-${sportName}`}
                    className="rounded-[3px] px-2.5 py-1 font-sans text-[10px] font-700 uppercase tracking-[1px]"
                    style={{ color: accent, background: `${accent}1f` }}
                  >
                    {sportIconByName[sportName] ?? "🏅"}{" "}
                    {leagueSport.sport.display_name}
                  </span>
                );
              },
            );

            return (
              <Carousel.Slide key={group.league.id}>
                <div className="rounded-[3px] border border-white/8 bg-surface-2 p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-sans text-base font-700 uppercase tracking-[1px] text-fg-1">
                      {group.league.name}
                    </p>
                    <span className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
                      {group.transfers.length} transfer
                      {group.transfers.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">{sportBadges}</div>

                  <div className="max-h-112 space-y-3 overflow-y-auto pr-1">
                    {group.transfers.map((transfer) => {
                      const outAccent =
                        sportAccentByName[transfer.player_out.sport?.name] ??
                        "#a0a0aa";
                      const inAccent =
                        sportAccentByName[transfer.player_in.sport?.name] ??
                        "#a0a0aa";
                      return (
                        <article
                          key={transfer.id}
                          className="card-surface p-4"
                        >
                          <p className="section-label">
                            {formatTransferTime(transfer.created_at)}
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-[3px] border border-[rgba(255,59,48,0.2)] bg-[rgba(255,59,48,0.06)] p-3">
                              <p className="font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-danger flex items-center gap-1">
                                <ChevronDown className="h-3 w-3" /> Out
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <PlayerAvatar
                                  name={resolvePlayerName(transfer.player_out)}
                                  photoUrl={transfer.player_out.photo_url}
                                  size="sm"
                                  className="shrink-0"
                                />
                                <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                                  {resolvePlayerName(transfer.player_out)}
                                </p>
                              </div>
                              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-3">
                                <span style={{ color: outAccent }}>
                                  {transfer.player_out.position}
                                </span>
                                {transfer.player_out.real_team ? (
                                  <>
                                    <span className="text-white/20">·</span>
                                    <TeamLogo
                                      teamName={transfer.player_out.real_team}
                                      logoUrl={transfer.player_out.real_team_logo_url}
                                      size="sm"
                                    />
                                    <span>{transfer.player_out.real_team}</span>
                                  </>
                                ) : null}
                              </p>
                              <p className="mt-1 font-display tracking-[-0.02em] text-accent">
                                ${formatMoney(transfer.player_out.cost)}
                              </p>
                            </div>

                            <div className="rounded-[3px] border border-success/20 bg-success/06 p-3">
                              <p className="font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-success flex items-center gap-1">
                                <ChevronUp className="h-3 w-3" /> In
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <PlayerAvatar
                                  name={resolvePlayerName(transfer.player_in)}
                                  photoUrl={transfer.player_in.photo_url}
                                  size="sm"
                                  className="shrink-0"
                                />
                                <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                                  {resolvePlayerName(transfer.player_in)}
                                </p>
                              </div>
                              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-3">
                                <span style={{ color: inAccent }}>
                                  {transfer.player_in.position}
                                </span>
                                {transfer.player_in.real_team ? (
                                  <>
                                    <span className="text-white/20">·</span>
                                    <TeamLogo
                                      teamName={transfer.player_in.real_team}
                                      logoUrl={transfer.player_in.real_team_logo_url}
                                      size="sm"
                                    />
                                    <span>{transfer.player_in.real_team}</span>
                                  </>
                                ) : null}
                              </p>
                              <p className="mt-1 font-display tracking-[-0.02em] text-accent">
                                ${formatMoney(transfer.player_in.cost)}
                              </p>
                            </div>
                          </div>

                          <p className="mt-3 text-xs text-fg-3">
                            Window {transfer.transfer_window.number}
                            <span className="mx-1.5 text-white/20">·</span>
                            Transfer cost {formatMoney(transfer.cost_at_transfer)}
                            {transfer.points_charged ? (
                              <>
                                <span className="mx-1.5 text-white/20">·</span>
                                <span className="text-warning">
                                  {formatMoney(transfer.points_charged)} pts charged
                                  (budget overage)
                                </span>
                              </>
                            ) : null}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </Carousel.Slide>
            );
          })}
        </Carousel>
      )}
      </div>
    </section>
  );
}
