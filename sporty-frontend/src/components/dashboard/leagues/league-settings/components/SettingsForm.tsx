"use client";

type LeagueSettingsData = {
  leagueName: string;
  sport: "football" | "basketball" | "cricket" | "multisport";
  isPrivate: boolean;
  teamSize: number;
  draftType: "snake" | "auction" | "auto";
  draftDate: string;
  matchesStarted: boolean;
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
        <label className="mb-1 block text-sm text-[#555560]">Sport</label>
        <select
          value={data.sport}
          disabled={data.matchesStarted}
          onChange={(event) =>
            onChange({
              sport: event.target.value as LeagueSettingsData["sport"],
            })
          }
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25] disabled:bg-[#1d1d26]"
        >
          <option value="football">Football</option>
          <option value="basketball">Basketball</option>
          <option value="cricket">Cricket</option>
          <option value="multisport">Multi-Sport</option>
        </select>
        {data.matchesStarted ? (
          <p className="mt-1 text-xs text-amber-100">
            Sport cannot be changed after matches start.
          </p>
        ) : null}
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-[#555560]">
            Team Size
          </label>
          <select
            value={data.teamSize}
            onChange={(event) =>
              onChange({ teamSize: Number(event.target.value) })
            }
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          >
            {[4, 6, 8, 10, 12, 14, 16].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[#555560]">
            Draft Type
          </label>
          <select
            value={data.draftType}
            onChange={(event) =>
              onChange({
                draftType: event.target
                  .value as LeagueSettingsData["draftType"],
              })
            }
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          >
            <option value="snake">Snake Draft</option>
            <option value="auction">Auction</option>
            <option value="auto">Auto-assign</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#555560]">
          Draft Date (optional)
        </label>
        <input
          type="date"
          value={data.draftDate}
          onChange={(event) => onChange({ draftDate: event.target.value })}
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
        />
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
