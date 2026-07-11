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
  football: "#4caf50",
  basketball: "#ff6b00",
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
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-6 py-4">
        <p className="section-label">Your Transfer History</p>
        <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
          Grouped by league
        </span>
      </div>

      <div className="p-6">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-[3px] bg-[#1d1d26]"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] p-4 text-sm text-[#ff8a8a]">
          Could not load your transfer history.
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-6 text-center text-sm text-[#555560]">
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
                const accent = sportAccentByName[sportName] ?? "#9a9aa5";
                return (
                  <span
                    key={`${group.league.id}-${sportName}`}
                    className="rounded-[3px] px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px]"
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
                <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                      {group.league.name}
                    </p>
                    <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
                      {group.transfers.length} transfer
                      {group.transfers.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">{sportBadges}</div>

                  <div className="max-h-112 space-y-3 overflow-y-auto pr-1">
                    {group.transfers.map((transfer) => {
                      const outAccent =
                        sportAccentByName[transfer.player_out.sport?.name] ??
                        "#9a9aa5";
                      const inAccent =
                        sportAccentByName[transfer.player_in.sport?.name] ??
                        "#9a9aa5";
                      return (
                        <article
                          key={transfer.id}
                          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4"
                        >
                          <p className="section-label">
                            {formatTransferTime(transfer.created_at)}
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-[3px] border border-[rgba(255,59,48,0.2)] bg-[rgba(255,59,48,0.06)] p-3">
                              <p className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#ff3b30] flex items-center gap-1">
                                <ChevronDown className="h-3 w-3" /> Out
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <PlayerAvatar
                                  name={resolvePlayerName(transfer.player_out)}
                                  photoUrl={transfer.player_out.photo_url}
                                  size="sm"
                                  className="shrink-0"
                                />
                                <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                                  {resolvePlayerName(transfer.player_out)}
                                </p>
                              </div>
                              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#555560]">
                                <span style={{ color: outAccent }}>
                                  {transfer.player_out.position}
                                </span>
                                {transfer.player_out.real_team ? (
                                  <>
                                    <span className="text-[#33333a]">·</span>
                                    <TeamLogo
                                      teamName={transfer.player_out.real_team}
                                      logoUrl={transfer.player_out.real_team_logo_url}
                                      size="sm"
                                    />
                                    <span>{transfer.player_out.real_team}</span>
                                  </>
                                ) : null}
                              </p>
                              <p className="mt-1 font-bebas tracking-[1px] text-[#e8fb25]">
                                ${formatMoney(transfer.player_out.cost)}
                              </p>
                            </div>

                            <div className="rounded-[3px] border border-[rgba(76,175,80,0.2)] bg-[rgba(76,175,80,0.06)] p-3">
                              <p className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#4caf50] flex items-center gap-1">
                                <ChevronUp className="h-3 w-3" /> In
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <PlayerAvatar
                                  name={resolvePlayerName(transfer.player_in)}
                                  photoUrl={transfer.player_in.photo_url}
                                  size="sm"
                                  className="shrink-0"
                                />
                                <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                                  {resolvePlayerName(transfer.player_in)}
                                </p>
                              </div>
                              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#555560]">
                                <span style={{ color: inAccent }}>
                                  {transfer.player_in.position}
                                </span>
                                {transfer.player_in.real_team ? (
                                  <>
                                    <span className="text-[#33333a]">·</span>
                                    <TeamLogo
                                      teamName={transfer.player_in.real_team}
                                      logoUrl={transfer.player_in.real_team_logo_url}
                                      size="sm"
                                    />
                                    <span>{transfer.player_in.real_team}</span>
                                  </>
                                ) : null}
                              </p>
                              <p className="mt-1 font-bebas tracking-[1px] text-[#e8fb25]">
                                ${formatMoney(transfer.player_in.cost)}
                              </p>
                            </div>
                          </div>

                          <p className="mt-3 text-xs text-[#555560]">
                            Window {transfer.transfer_window.number}
                            <span className="mx-1.5 text-[#33333a]">·</span>
                            Transfer cost {formatMoney(transfer.cost_at_transfer)}
                            {transfer.points_charged ? (
                              <>
                                <span className="mx-1.5 text-[#33333a]">·</span>
                                <span className="text-[#ffd86b]">
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
