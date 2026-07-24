"use client";

import { useMemo, useState } from "react";
import { Popover } from "@mantine/core";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { toDateKey } from "./MatchDateStrip";

type CalendarPopoverProps = {
  /** YYYY-MM-DD */
  selectedDate: string;
  onDateChange: (date: string) => void;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Days for the month grid, padded to whole Monday-start weeks.
function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarPopover({ selectedDate, onDateChange }: CalendarPopoverProps) {
  const [opened, setOpened] = useState(false);
  const selected = parseKey(selectedDate);
  const [view, setView] = useState({ year: selected.getFullYear(), month: selected.getMonth() });

  const todayKey = toDateKey(new Date());
  const cells = useMemo(() => monthGrid(view.year, view.month), [view]);

  const shiftMonth = (delta: number) => {
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const pick = (d: Date) => {
    onDateChange(toDateKey(d));
    setOpened(false);
  };

  const triggerLabel = selected.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={288}
      position="bottom-end"
      shadow="xl"
      withinPortal
    >
      <Popover.Target>
        <button
          type="button"
          onClick={() => {
            setView({ year: selected.getFullYear(), month: selected.getMonth() });
            setOpened((o) => !o);
          }}
          aria-label="Open calendar"
          aria-expanded={opened}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-white/12 px-2.5 py-1.5 font-sans text-xs font-700 text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
        >
          <CalendarDays className="size-4" />
          <span className="hidden sm:inline">{triggerLabel}</span>
        </button>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          background: "#111117",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "12px",
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="grid size-7 place-items-center rounded-[3px] text-fg-3 transition-colors hover:bg-white/6 hover:text-fg-1"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-sans text-sm font-700 text-fg-1">
            {MONTHS[view.month]} {view.year}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="grid size-7 place-items-center rounded-[3px] text-fg-3 transition-colors hover:bg-white/6 hover:text-fg-1"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((w, i) => (
            <span
              key={i}
              className="grid h-7 place-items-center font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3"
            >
              {w}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <span key={i} className="h-8" />;
            const key = toDateKey(d);
            const isSelected = key === selectedDate;
            const isToday = key === todayKey;
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(d)}
                aria-label={d.toDateString()}
                aria-current={isSelected ? "date" : undefined}
                className={`grid h-8 place-items-center rounded-[3px] text-sm tabular-nums transition-colors ${
                  isSelected
                    ? "bg-accent font-700 text-surface-0"
                    : isToday
                      ? "border border-accent/40 text-accent hover:bg-white/6"
                      : "text-fg-2 hover:bg-white/6 hover:text-fg-1"
                }`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => pick(new Date())}
          className="mt-2 w-full rounded-[3px] border border-white/12 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
        >
          Today
        </button>
      </Popover.Dropdown>
    </Popover>
  );
}
