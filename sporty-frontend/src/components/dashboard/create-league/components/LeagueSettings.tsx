"use client";

type LeagueSettingsProps = {
  isPrivate: boolean;
  teamSize: number;
  competitionType: "draft" | "budget";
  draftDate: string;
  onSettingsChange: (next: {
    isPrivate?: boolean;
    teamSize?: number;
    competitionType?: "draft" | "budget";
    draftDate?: string;
  }) => void;
};

const teamSizes = [4, 6, 8, 10, 12, 14, 16];

export function LeagueSettings({
  isPrivate,
  teamSize,
  competitionType,
  draftDate,
  onSettingsChange,
}: LeagueSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm text-[#555560]">League Type</p>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 transition-all hover:border-[rgba(232,251,37,0.2)] hover:bg-[#1d1d26]">
            <input
              type="radio"
              name="league-type"
              checked={!isPrivate}
              onChange={() => onSettingsChange({ isPrivate: false })}
              className="mt-0.5 h-4 w-4 border-[rgba(255,255,255,0.08)] text-[#e8fb25]"
            />
            <span>
              <p className="text-sm text-[#f0f0f0]">Public</p>
              <p className="mt-1 text-xs text-[#555560]">Anyone can join.</p>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 transition-all hover:border-[rgba(232,251,37,0.2)] hover:bg-[#1d1d26]">
            <input
              type="radio"
              name="league-type"
              checked={isPrivate}
              onChange={() => onSettingsChange({ isPrivate: true })}
              className="mt-0.5 h-4 w-4 border-[rgba(255,255,255,0.08)] text-[#e8fb25]"
            />
            <span>
              <p className="text-sm text-[#f0f0f0]">Private</p>
              <p className="mt-1 text-xs text-[#555560]">Invite code only.</p>
            </span>
          </label>
        </div>
      </div>

      <div>
        <label
          htmlFor="team-size"
          className="mb-2 block text-sm text-[#555560]"
        >
          Team Size
        </label>
        <select
          id="team-size"
          value={teamSize}
          onChange={(event) =>
            onSettingsChange({ teamSize: Number(event.target.value) })
          }
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-4 py-3 text-[#f0f0f0] outline-none transition-all scheme-dark focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          style={{ colorScheme: "dark" }}
        >
          {teamSizes.map((size) => (
            <option key={size} value={size}>
              {size} teams
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="competition-type"
          className="mb-2 block text-sm text-[#555560]"
        >
          Competition Type
        </label>
        <select
          id="competition-type"
          value={competitionType}
          onChange={(event) =>
            onSettingsChange({
              competitionType: event.target.value as "draft" | "budget",
            })
          }
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-4 py-3 text-[#f0f0f0] outline-none transition-all scheme-dark focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          style={{ colorScheme: "dark" }}
        >
          <option value="draft">Draft Mode</option>
          <option value="budget">Budget Mode (Auto Assign)</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="draft-date"
          className="mb-2 block text-sm text-[#555560]"
        >
          Draft Date (optional)
        </label>
        <input
          id="draft-date"
          type="date"
          value={draftDate}
          onChange={(event) =>
            onSettingsChange({ draftDate: event.target.value })
          }
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3 text-[#f0f0f0] outline-none transition-all focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
        />
      </div>
    </div>
  );
}
