"use client";

import Link from "next/link";
import { ChevronDown, ListOrdered, Star } from "lucide-react";

import { Badge } from "@/components/ui";
import { sportGlyph } from "@/components/landing/sport-icons";
import { competitionRouteTag } from "@/lib/footballCompetitions";
import type { FixtureGroup as Group } from "../fixtureFormat";
import { FixtureRow } from "./FixtureRow";

export function FixtureGroup({
  group,
  followed,
  onToggleFollow,
  style,
}: {
  group: Group;
  followed: boolean;
  onToggleFollow: (competition: string) => void;
  style?: React.CSSProperties;
}) {
  const glyph = sportGlyph(group.sport);
  const Glyph = glyph.Icon;
  const routeTag = competitionRouteTag(group.competition);

  return (
    <details open className="group/panel pop-in overflow-hidden card-surface" style={style}>
      <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/3 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-[4px]"
            style={{ color: glyph.color, background: `${glyph.color}1a` }}
            aria-hidden="true"
          >
            <Glyph className="size-3.5" />
          </span>
          <span className="truncate font-sans text-xs font-700 uppercase tracking-[2px] text-fg-1">
            {group.competition}
          </span>
          <button
            type="button"
            aria-label={followed ? `Unfollow ${group.competition}` : `Follow ${group.competition}`}
            aria-pressed={followed}
            onClick={(e) => {
              e.preventDefault();
              onToggleFollow(group.competition);
            }}
            className="shrink-0 rounded-[3px] p-0.5 transition-colors hover:bg-white/8"
          >
            <Star
              className={`size-3.5 ${followed ? "fill-accent text-accent" : "text-fg-3 hover:text-fg-1"}`}
            />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {routeTag && (
            <Link
              href={`/competitions/${routeTag}`}
              onClick={(e) => e.stopPropagation()}
              aria-label={`${group.competition} standings`}
              className="inline-flex items-center gap-1 rounded-[3px] border border-white/10 px-2 py-1 font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3 transition-colors hover:border-accent/40 hover:text-accent hover:no-underline"
            >
              <ListOrdered className="size-3" />
              <span className="hidden sm:inline">Standings</span>
            </Link>
          )}
          {group.live > 0 ? (
            <Badge tone="danger" size="sm" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
              {group.live} Live
            </Badge>
          ) : (
            <span className="font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
              {group.fixtures.length}
            </span>
          )}
          <ChevronDown className="size-4 text-fg-3 transition-transform group-open/panel:rotate-180" />
        </div>
      </summary>
      <div className="divide-y divide-white/5 border-t border-white/7">
        {group.fixtures.map((f) => (
          <FixtureRow key={`${f.source}:${f.id}`} fixture={f} />
        ))}
      </div>
    </details>
  );
}
