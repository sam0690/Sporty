"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { StatTile } from "@/components/ui";

type ProfileHeroProps = {
  label: string;
  name: string;
  avatar: string;
  joinDate: string;
  totalPoints: number;
  totalLeagues: number;
  bestRank: number | null;
  action?: ReactNode;
};

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ProfileHero({
  label,
  name,
  avatar,
  joinDate,
  totalPoints,
  totalLeagues,
  bestRank,
  action,
}: ProfileHeroProps) {
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <section className="card-surface p-6 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="section-label">{label}</p>
        {action}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Identity */}
        <div className="flex items-center gap-4">
          {avatar ? (
            <Image
              src={avatar}
              alt={`${name} avatar`}
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-accent/10 font-display text-4xl tracking-[-0.02em] text-accent">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-4xl tracking-[-0.02em] text-fg-1">
              {name}
            </h1>
            <p className="mt-1 text-xs text-fg-3">Joined {formatDate(joinDate)}</p>
          </div>
        </div>

        {/* Headline stats */}
        <div className="flex items-center gap-8 border-t border-white/8 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <StatTile label="Total Points" value={Math.round(totalPoints)} size="hero" />
          <StatTile
            label="Leagues"
            value={totalLeagues}
            size="default"
            tone="neutral"
          />
          <StatTile
            label="Best Rank"
            value={bestRank ? `#${bestRank}` : "—"}
            size="default"
            tone="neutral"
          />
        </div>
      </div>
    </section>
  );
}
