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
    <section className="rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-black sm:text-xl">
          Your Transfer History
        </h3>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-secondary">
          Grouped by league
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-md bg-accent/20"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          Could not load your transfer history.
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-border bg-[#F4F4F9] p-4 text-sm text-secondary">
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
                    className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-secondary"
                  >
                    {sportIconByName[sportName] ?? "🏅"}{" "}
                    {leagueSport.sport.display_name}
                  </span>
                );
              },
            );

            return (
              <Carousel.Slide key={group.league.id}>
                <div className="rounded-lg border border-border bg-[#F4F4F9]/70 p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold text-black">
                      {group.league.name}
                    </p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-secondary">
                      {group.transfers.length} transfer
                      {group.transfers.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">{sportBadges}</div>

                  <div className="max-h-112 space-y-3 overflow-y-auto pr-1">
                    {group.transfers.map((transfer) => (
                      <article
                        key={transfer.id}
                        className="rounded-md border border-border bg-white p-4 shadow-sm"
                      >
                        <p className="text-xs font-medium text-secondary">
                          {formatTransferTime(transfer.created_at)}
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                              Out
                            </p>
                            <p className="mt-1 text-sm font-semibold text-black">
                              {resolvePlayerName(transfer.player_out)}
                            </p>
                            <p className="mt-1 text-xs text-secondary">
                              {sportIconByName[
                                transfer.player_out.sport?.name
                              ] ?? "🏅"}{" "}
                              {transfer.player_out.position}
                            </p>
                            <p className="text-xs text-secondary">
                              {transfer.player_out.real_team}
                            </p>
                            <p className="mt-1 text-xs font-medium text-black">
                              Value {formatMoney(transfer.player_out.cost)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                              In
                            </p>
                            <p className="mt-1 text-sm font-semibold text-black">
                              {resolvePlayerName(transfer.player_in)}
                            </p>
                            <p className="mt-1 text-xs text-secondary">
                              {sportIconByName[
                                transfer.player_in.sport?.name
                              ] ?? "🏅"}{" "}
                              {transfer.player_in.position}
                            </p>
                            <p className="text-xs text-secondary">
                              {transfer.player_in.real_team}
                            </p>
                            <p className="mt-1 text-xs font-medium text-black">
                              Value {formatMoney(transfer.player_in.cost)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-secondary">
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
