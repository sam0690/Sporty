"use client";

import { Carousel } from "@mantine/carousel";
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
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6  sm:p-7">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-600 text-[#f0f0f0] sm:text-xl">
          Your Transfer History
        </h3>
        <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 text-xs text-[#f0f0f0]">
          Grouped by league
        </span>
      </div>

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
        <div className="rounded-[3px] border border-danger/20 bg-danger/10 p-4 text-sm text-red-300">
          Could not load your transfer history.
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-sm text-[#555560]">
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
                return (
                  <span
                    key={`${group.league.id}-${sportName}`}
                    className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-2.5 py-1 text-xs text-[#f0f0f0]"
                  >
                    {sportIconByName[sportName] ?? "🏅"}{" "}
                    {leagueSport.sport.display_name}
                  </span>
                );
              },
            );

            return (
              <Carousel.Slide key={group.league.id}>
                <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-600 text-[#f0f0f0]">
                      {group.league.name}
                    </p>
                    <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-2.5 py-1 text-xs text-[#f0f0f0]">
                      {group.transfers.length} transfer
                      {group.transfers.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">{sportBadges}</div>

                  <div className="max-h-112 space-y-3 overflow-y-auto pr-1">
                    {group.transfers.map((transfer) => (
                      <article
                        key={transfer.id}
                        className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4"
                      >
                        <p className="text-xs text-[#555560]">
                          {formatTransferTime(transfer.created_at)}
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-[3px] border border-red-500/20 bg-red-500/10 p-3">
                            <p className="text-xs font-600 uppercase tracking-wide text-red-300">
                              Out
                            </p>
                            <p className="mt-1 text-sm font-600 text-[#f0f0f0]">
                              {resolvePlayerName(transfer.player_out)}
                            </p>
                            <p className="mt-1 text-xs text-[#555560]">
                              {sportIconByName[
                                transfer.player_out.sport?.name
                              ] ?? "🏅"}{" "}
                              {transfer.player_out.position}
                            </p>
                            <p className="text-xs text-[#555560]">
                              {transfer.player_out.real_team}
                            </p>
                            <p className="mt-1 text-xs text-[#f0f0f0]">
                              Value {formatMoney(transfer.player_out.cost)}
                            </p>
                          </div>

                          <div className="rounded-[3px] border border-emerald-400/20 bg-emerald-400/10 p-3">
                            <p className="text-xs font-600 uppercase tracking-wide text-emerald-300">
                              In
                            </p>
                            <p className="mt-1 text-sm font-600 text-[#f0f0f0]">
                              {resolvePlayerName(transfer.player_in)}
                            </p>
                            <p className="mt-1 text-xs text-[#555560]">
                              {sportIconByName[
                                transfer.player_in.sport?.name
                              ] ?? "🏅"}{" "}
                              {transfer.player_in.position}
                            </p>
                            <p className="text-xs text-[#555560]">
                              {transfer.player_in.real_team}
                            </p>
                            <p className="mt-1 text-xs text-[#f0f0f0]">
                              Value {formatMoney(transfer.player_in.cost)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-[#555560]">
                          Window {transfer.transfer_window.number} • Transfer
                          cost {formatMoney(transfer.cost_at_transfer)}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </Carousel.Slide>
            );
          })}
        </Carousel>
      )}
    </section>
  );
}
