"use client";

import { useMatchStore } from "@/store/matchStore";
import type { LineupChange } from "@/types/events";
import { Panel } from "./Panel";
import { SubIcon } from "./icons";

export function LineupCard() {
  const lineup = useMatchStore((s) => s.lineup);
  const players = useMatchStore((s) => s.players);
  const entries = Object.entries(lineup);

  const nameFor = (id: string | undefined) =>
    (id && players[id]?.name) || id || "—";

  if (entries.length === 0) {
    return null;
  }

  return (
    <Panel title="Lineup Changes" icon={<SubIcon className="size-3.5" />}>
      <ul className="space-y-2">
        {entries.map(([teamId, raw]) => {
          const change = raw as LineupChange;
          return (
            <li
              key={teamId}
              className="rounded-[8px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-3.5 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#6B7280]">
                  {nameFor(change.team_id ?? teamId)}
                </span>
                {change.minute != null && (
                  <span className="font-bebas text-sm leading-none tracking-[1px] text-[#DC2626]">
                    {change.minute}&apos;
                  </span>
                )}
              </div>
              <div className="mt-2.5 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[rgba(0,255,136,0.14)] text-[#16A34A]">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 19V5M12 5l-5 5M12 5l5 5" />
                    </svg>
                  </span>
                  <span className="truncate text-[#3A4256]">
                    {nameFor(change.player_in)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[rgba(255,59,92,0.14)] text-[#DC2626]">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 5v14M12 19l-5-5M12 19l5-5" />
                    </svg>
                  </span>
                  <span className="truncate text-[#6B7280]">
                    {nameFor(change.player_out)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
