"use client";

import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
};

// Shared shell for every settings block — keeps the page on the system's
// #111117 card + section-label header register instead of ad-hoc cards.
export function SettingsSection({
  title,
  description,
  action,
  tone = "default",
  children,
}: SettingsSectionProps) {
  const border =
    tone === "danger"
      ? "border-[rgba(255,59,48,0.25)]"
      : "border-[rgba(255,255,255,0.08)]";

  return (
    <section
      className={`overflow-hidden rounded-[3px] border ${border} bg-[#111117] animate-fade-soft`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b ${border} px-5 py-3`}
      >
        <div>
          <p
            className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[0.2em]"
            style={{ color: tone === "danger" ? "#ff3b30" : "rgba(255,255,255,0.5)" }}
          >
            {title}
          </p>
          {description ? (
            <p className="mt-1 text-xs text-[#555560]">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// Shared control class strings so toggles/inputs look identical everywhere.
export const segmentBase =
  "rounded-[3px] border px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] transition-colors";
export const segmentActive =
  "border-[rgba(232,251,37,0.4)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]";
export const segmentIdle =
  "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5] hover:text-[#f0f0f0]";
export const settingsInput =
  "w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-2.5 text-sm text-[#f0f0f0] outline-none transition-colors focus:border-[#e8fb25]";
