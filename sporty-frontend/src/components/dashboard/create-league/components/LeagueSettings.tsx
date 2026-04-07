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
        <p className="mb-2 text-sm text-gray-600">League Type</p>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
            <input
              type="radio"
              name="league-type"
              checked={!isPrivate}
              onChange={() => onSettingsChange({ isPrivate: false })}
              className="mt-0.5 h-4 w-4 border-gray-300 text-primary-600"
            />
            <span>
              <p className="text-sm font-medium text-gray-900">Public</p>
              <p className="mt-1 text-xs text-gray-500">Anyone can join.</p>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
            <input
              type="radio"
              name="league-type"
              checked={isPrivate}
              onChange={() => onSettingsChange({ isPrivate: true })}
              className="mt-0.5 h-4 w-4 border-gray-300 text-primary-600"
            />
            <span>
              <p className="text-sm font-medium text-gray-900">Private</p>
              <p className="mt-1 text-xs text-gray-500">Invite code only.</p>
            </span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="team-size" className="mb-2 block text-sm text-gray-600">
          Team Size
        </label>
        <select
          id="team-size"
          value={teamSize}
          onChange={(event) =>
            onSettingsChange({ teamSize: Number(event.target.value) })
          }
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none transition focus:border-primary-400"
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
          className="mb-2 block text-sm text-gray-600"
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
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none transition focus:border-primary-400"
        >
          <option value="draft">Draft Mode</option>
          <option value="budget">Budget Mode (Auto Assign)</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="draft-date"
          className="mb-2 block text-sm text-gray-600"
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
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none transition focus:border-primary-400"
        />
      </div>
    </div>
  );
}
