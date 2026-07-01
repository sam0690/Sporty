"use client";

import { Carousel } from "@mantine/carousel";
import { SportIcon } from "@/components/landing/sport-icons";
import type { TUserTransferLeagueGroup } from "@/types";

type UserTransferHistoryCarouselProps = {
  groups: TUserTransferLeagueGroup[];
  isLoading: boolean;
  isError: boolean;
};


const sportAccentByName: Record<string, string> = {
  football: "#16A34A",
  basketball: "#EA580C",
  cricket: "#0891B2",
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
    <section className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
      <div className="flex items-center justify-between border-b border-[rgba(11,18,32,0.08)] px-6 py-4">
        <p className="section-label">Your Transfer History</p>
        <span className="font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#6B7280]">
          Grouped by league
        </span>
      </div>

      <div className="p-6">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-[3px] bg-[#F3F4F7]"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] p-4 text-sm text-[#DC2626]">
          Could not load your transfer history.
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-6 text-center text-sm text-[#6B7280]">
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
                const accent = sportAccentByName[sportName] ?? "#6B7280";
                return (
                  <span
                    key={`${group.league.id}-${sportName}`}
                    className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-condensed text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: accent, background: `${accent}1f` }}
                  >
                    <SportIcon sport={sportName} className="h-3 w-3" />
                    {leagueSport.sport.display_name}
                  </span>
                );
              },
            );

            return (
              <Carousel.Slide key={group.league.id}>
                <div className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-barlow-condensed text-base font-bold uppercase tracking-[1px] text-[#0B1220]">
                      {group.league.name}
                    </p>
                    <span className="font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#6B7280]">
                      {group.transfers.length} transfer
                      {group.transfers.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">{sportBadges}</div>

                  <div className="max-h-112 space-y-3 overflow-y-auto pr-1">
                    {group.transfers.map((transfer) => {
                      const outAccent =
                        sportAccentByName[transfer.player_out.sport?.name] ??
                        "#6B7280";
                      const inAccent =
                        sportAccentByName[transfer.player_in.sport?.name] ??
                        "#6B7280";
                      return (
                        <article
                          key={transfer.id}
                          className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-4"
                        >
                          <p className="section-label">
                            {formatTransferTime(transfer.created_at)}
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-[3px] border border-[rgba(255,59,48,0.2)] bg-[rgba(255,59,48,0.06)] p-3">
                              <p className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#DC2626]">
                                ▼ Out
                              </p>
                              <p className="mt-1 truncate font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
                                {resolvePlayerName(transfer.player_out)}
                              </p>
                              <p className="mt-1 text-xs text-[#6B7280]">
                                <span style={{ color: outAccent }}>
                                  {transfer.player_out.position}
                                </span>
                                <span className="mx-1.5 text-[#EAECF0]">·</span>
                                {transfer.player_out.real_team}
                              </p>
                              <p className="mt-1 font-bebas tracking-[1px] text-[#DC2626]">
                                ${formatMoney(transfer.player_out.cost)}
                              </p>
                            </div>

                            <div className="rounded-[3px] border border-[rgba(76,175,80,0.2)] bg-[rgba(76,175,80,0.06)] p-3">
                              <p className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#16A34A]">
                                ▲ In
                              </p>
                              <p className="mt-1 truncate font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
                                {resolvePlayerName(transfer.player_in)}
                              </p>
                              <p className="mt-1 text-xs text-[#6B7280]">
                                <span style={{ color: inAccent }}>
                                  {transfer.player_in.position}
                                </span>
                                <span className="mx-1.5 text-[#EAECF0]">·</span>
                                {transfer.player_in.real_team}
                              </p>
                              <p className="mt-1 font-bebas tracking-[1px] text-[#DC2626]">
                                ${formatMoney(transfer.player_in.cost)}
                              </p>
                            </div>
                          </div>

                          <p className="mt-3 text-xs text-[#6B7280]">
                            Window {transfer.transfer_window.number}
                            <span className="mx-1.5 text-[#EAECF0]">·</span>
                            Transfer cost {formatMoney(transfer.cost_at_transfer)}
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
