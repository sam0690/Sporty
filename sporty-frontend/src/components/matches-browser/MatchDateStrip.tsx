"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type MatchDateStripProps = {
  /** YYYY-MM-DD, local calendar day. */
  selectedDate: string;
  onDateChange: (date: string) => void;
};

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WINDOW_RADIUS = 3;

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

/** Shift a YYYY-MM-DD key by whole days (local calendar). */
export function shiftDateKey(key: string, delta: number): string {
  return toDateKey(addDays(parseDateKey(key), delta));
}

export function MatchDateStrip({ selectedDate, onDateChange }: MatchDateStripProps) {
  const selected = parseDateKey(selectedDate);
  const todayKey = toDateKey(new Date());

  const days = Array.from({ length: WINDOW_RADIUS * 2 + 1 }, (_, i) =>
    addDays(selected, i - WINDOW_RADIUS),
  );

  const shift = (delta: number) => onDateChange(toDateKey(addDays(selected, delta)));

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="Previous day"
        className="grid size-8 shrink-0 place-items-center rounded-[3px] border border-white/12 text-fg-3 transition-colors hover:border-white/28 hover:text-fg-1"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        {days.map((d) => {
          const key = toDateKey(d);
          const isSelected = key === selectedDate;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDateChange(key)}
              className={
                isSelected
                  ? "flex shrink-0 flex-col items-center rounded-[3px] bg-accent px-3 py-1.5 text-surface-0 transition-colors hover:bg-accent-bright"
                  : "flex shrink-0 flex-col items-center rounded-[3px] border border-white/12 px-3 py-1.5 text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
              }
            >
              <span className="font-sans text-[10px] font-700 uppercase tracking-[1.5px]">
                {isToday ? "Today" : DAY_LABELS[d.getDay()]}
              </span>
              <span className="num text-sm font-700">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => shift(1)}
        aria-label="Next day"
        className="grid size-8 shrink-0 place-items-center rounded-[3px] border border-white/12 text-fg-3 transition-colors hover:border-white/28 hover:text-fg-1"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
