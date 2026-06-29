"use client";

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

export function SettingsForm({ data, onChange }: SettingsFormProps) {
  return (
    <section className="space-y-6 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
      <h3 className="text-sm text-[#f0f0f0]">League Settings</h3>

      <div>
        <label className="mb-1 block text-sm text-[#555560]">
          League Name
        </label>
        <input
          value={data.leagueName}
          maxLength={50}
          onChange={(event) => onChange({ leagueName: event.target.value })}
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#555560]">
          League Type
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ isPrivate: false })}
            className={`rounded-[3px] border px-4 py-2 text-sm ${!data.isPrivate ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]" : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560]"}`}
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => onChange({ isPrivate: true })}
            className={`rounded-[3px] border px-4 py-2 text-sm ${data.isPrivate ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]" : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560]"}`}
          >
            Private
          </button>
        </div>
        <p className="mt-1 text-xs text-[#f0f0f0]/50">
          Public leagues are discoverable by anyone; private leagues can only be
          joined with an invite code.
        </p>
      </div>

      {data.showMidseasonJoinToggle ? (
        <div>
          <label className="mb-1 block text-sm text-[#555560]">
            Mid-Season Joining
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ allowMidseasonJoin: true })}
              className={`rounded-[3px] border px-4 py-2 text-sm ${data.allowMidseasonJoin ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]" : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560]"}`}
            >
              Enabled
            </button>
            <button
              type="button"
              onClick={() => onChange({ allowMidseasonJoin: false })}
              className={`rounded-[3px] border px-4 py-2 text-sm ${!data.allowMidseasonJoin ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]" : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560]"}`}
            >
              Disabled
            </button>
          </div>
          <p className="mt-1 text-xs text-[#f0f0f0]/50">
            When enabled, new users can join while the league is active and
            start scoring from the next transfer window.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export type { LeagueSettingsData };
