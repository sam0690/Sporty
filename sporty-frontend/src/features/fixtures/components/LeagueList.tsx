"use client";

import { Star } from "lucide-react";

import { sportGlyph } from "@/components/landing/sport-icons";
import { competitionMetaByName } from "@/lib/footballCompetitions";
import type { LeagueEntry } from "../fixtureFormat";

type LeagueListProps = {
  entries: LeagueEntry[];
  /** null = "All competitions". */
  active: string | null;
  onSelect: (competition: string | null) => void;
  onToggleFollow: (competition: string) => void;
};

function LeagueIcon({ competition, sport }: { competition: string; sport: string }) {
  const meta = competitionMetaByName(competition);
  if (meta) {
    return (
      <span className="grid size-5 shrink-0 place-items-center text-sm leading-none" aria-hidden="true">
        {meta.flag}
      </span>
    );
  }
  const glyph = sportGlyph(sport);
  const Glyph = glyph.Icon;
  return (
    <span
      className="grid size-5 shrink-0 place-items-center rounded-[3px]"
      style={{ color: glyph.color, background: `${glyph.color}1a` }}
    >
      <Glyph className="size-3" />
    </span>
  );
}

export function LeagueList({ entries, active, onSelect, onToggleFollow }: LeagueListProps) {
  return (
    <nav className="space-y-0.5" aria-label="Competitions">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`flex w-full items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-left text-sm font-700 transition-colors ${
          active === null ? "bg-accent/10 text-accent" : "text-fg-2 hover:bg-white/5 hover:text-fg-1"
        }`}
      >
        <span className="grid size-5 shrink-0 place-items-center text-sm" aria-hidden="true">
          🌍
        </span>
        All competitions
      </button>

      {entries.map((e) => {
        const isActive = active === e.competition;
        return (
          <div
            key={e.competition}
            className={`flex items-center gap-1 rounded-[3px] pr-1 transition-colors ${
              isActive ? "bg-accent/10" : "hover:bg-white/5"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(isActive ? null : e.competition)}
              className={`flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm transition-colors ${
                isActive ? "font-700 text-accent" : "font-500 text-fg-2 hover:text-fg-1"
              }`}
            >
              <LeagueIcon competition={e.competition} sport={e.sport} />
              <span className="min-w-0 flex-1 truncate">{e.competition}</span>
              {e.live > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-700 uppercase tracking-[1px] text-danger">
                  <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
                  {e.live}
                </span>
              ) : e.count > 0 ? (
                <span className="text-[11px] tabular-nums text-fg-3">{e.count}</span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label={e.followed ? `Unfollow ${e.competition}` : `Follow ${e.competition}`}
              aria-pressed={e.followed}
              onClick={() => onToggleFollow(e.competition)}
              className="shrink-0 rounded-[3px] p-1 transition-colors hover:bg-white/8"
            >
              <Star
                className={`size-3.5 ${e.followed ? "fill-accent text-accent" : "text-fg-3 hover:text-fg-1"}`}
              />
            </button>
          </div>
        );
      })}

      {entries.length === 0 && (
        <p className="px-2.5 py-4 text-xs text-fg-3">No competitions on this day.</p>
      )}
    </nav>
  );
}
