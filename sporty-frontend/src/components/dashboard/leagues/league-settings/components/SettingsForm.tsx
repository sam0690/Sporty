"use client";

import {
  SettingsSection,
  segmentActive,
  segmentBase,
  segmentIdle,
  settingsInput,
} from "@/components/dashboard/leagues/league-settings/components/SettingsSection";

type LeagueSettingsData = {
  leagueName: string;
  isPrivate: boolean;
  allowMidseasonJoin: boolean;
  showMidseasonJoinToggle?: boolean;
};

type SettingsFormProps = {
  data: LeagueSettingsData;
  onChange: (next: Partial<LeagueSettingsData>) => void;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5]">
      {children}
    </label>
  );
}

export function SettingsForm({ data, onChange }: SettingsFormProps) {
  return (
    <SettingsSection
      title="League Settings"
      description="Name and visibility of your league"
    >
      <div className="space-y-6">
        <div>
          <FieldLabel>League Name</FieldLabel>
          <input
            value={data.leagueName}
            maxLength={50}
            onChange={(event) => onChange({ leagueName: event.target.value })}
            className={settingsInput}
          />
        </div>

        <div>
          <FieldLabel>League Type</FieldLabel>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ isPrivate: false })}
              className={`${segmentBase} ${!data.isPrivate ? segmentActive : segmentIdle}`}
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => onChange({ isPrivate: true })}
              className={`${segmentBase} ${data.isPrivate ? segmentActive : segmentIdle}`}
            >
              Private
            </button>
          </div>
          <p className="mt-2 text-xs text-[#555560]">
            Public leagues are discoverable by anyone; private leagues can only
            be joined with an invite code.
          </p>
        </div>

        {data.showMidseasonJoinToggle ? (
          <div>
            <FieldLabel>Mid-Season Joining</FieldLabel>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ allowMidseasonJoin: true })}
                className={`${segmentBase} ${data.allowMidseasonJoin ? segmentActive : segmentIdle}`}
              >
                Enabled
              </button>
              <button
                type="button"
                onClick={() => onChange({ allowMidseasonJoin: false })}
                className={`${segmentBase} ${!data.allowMidseasonJoin ? segmentActive : segmentIdle}`}
              >
                Disabled
              </button>
            </div>
            <p className="mt-2 text-xs text-[#555560]">
              When enabled, new users can join while the league is active and
              start scoring from the next transfer window.
            </p>
          </div>
        ) : null}
      </div>
    </SettingsSection>
  );
}

export type { LeagueSettingsData };
