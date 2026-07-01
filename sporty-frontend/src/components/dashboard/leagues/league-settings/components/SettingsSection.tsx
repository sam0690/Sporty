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
// #FFFFFF card + section-label header register instead of ad-hoc cards.
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
      : "border-[rgba(11,18,32,0.08)]";

  return (
    <section
      className={`overflow-hidden rounded-[3px] border ${border} bg-[#FFFFFF] animate-fade-soft`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b ${border} px-5 py-3`}
      >
        <div>
          <p
            className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: tone === "danger" ? "#DC2626" : "rgba(11,18,32,0.5)" }}
          >
            {title}
          </p>
          {description ? (
            <p className="mt-1 text-xs text-[#6B7280]">{description}</p>
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
  "rounded-[3px] border px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] transition-colors";
export const segmentActive =
  "border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.1)] text-[#DC2626]";
export const segmentIdle =
  "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280] hover:text-[#0B1220]";
export const settingsInput =
  "w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-2.5 text-sm text-[#0B1220] outline-none transition-colors focus:border-[#DC2626]";
