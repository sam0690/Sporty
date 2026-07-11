"use client";

import { SettingsSection } from "@/components/dashboard/leagues/league-settings/components/SettingsSection";

type DangerZoneProps = {
  leagueName: string;
  onDeleteClick: () => void;
};

export function DangerZone({ leagueName, onDeleteClick }: DangerZoneProps) {
  return (
    <SettingsSection
      title="Danger Zone"
      description="Irreversible actions"
      tone="danger"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-fg-2">
          Delete{" "}
          <span className="font-600 text-fg-1">{leagueName}</span>{" "}
          permanently. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={onDeleteClick}
          className="shrink-0 rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-transparent px-5 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-danger transition-colors hover:bg-[rgba(255,59,48,0.1)]"
        >
          Delete League
        </button>
      </div>
    </SettingsSection>
  );
}
