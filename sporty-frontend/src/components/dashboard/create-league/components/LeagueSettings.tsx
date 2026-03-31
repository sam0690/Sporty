"use client";

type LeagueSettingsProps = {
  isPrivate: boolean;
  teamSize: number;
  draftType: string;
  draftDate: string;
  onSettingsChange: (next: { isPrivate?: boolean; teamSize?: number; draftType?: string; draftDate?: string }) => void;
};

const teamSizes = [4, 6, 8, 10, 12, 14, 16];

export function LeagueSettings({ isPrivate, teamSize, draftType, draftDate, onSettingsChange }: LeagueSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-text-primary">League Type</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSettingsChange({ isPrivate: false })}
            className={`rounded-lg border-2 p-4 text-left transition-colors ${
              !isPrivate ? "border-primary-500 bg-primary-50" : "border-border hover:border-primary-500"
            }`}
          >
            <p className="text-sm font-semibold text-text-primary">Public</p>
            <p className="mt-1 text-xs text-text-secondary">Anyone can discover and join.</p>
          </button>
          <button
            type="button"
            onClick={() => onSettingsChange({ isPrivate: true })}
            className={`rounded-lg border-2 p-4 text-left transition-colors ${
              isPrivate ? "border-primary-500 bg-primary-50" : "border-border hover:border-primary-500"
            }`}
          >
            <p className="text-sm font-semibold text-text-primary">Private</p>
            <p className="mt-1 text-xs text-text-secondary">Invite code only.</p>
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="team-size" className="mb-2 block text-sm font-medium text-text-primary">
          Team Size
        </label>
        <select
          id="team-size"
          value={teamSize}
          onChange={(event) => onSettingsChange({ teamSize: Number(event.target.value) })}
          className="w-full rounded-lg border border-border px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary-500"
        >
          {teamSizes.map((size) => (
            <option key={size} value={size}>
              {size} teams
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="draft-type" className="mb-2 block text-sm font-medium text-text-primary">
          Draft Type
        </label>
        <select
          id="draft-type"
          value={draftType}
          onChange={(event) => onSettingsChange({ draftType: event.target.value })}
          className="w-full rounded-lg border border-border px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="snake">Snake Draft</option>
          <option value="auction">Auction</option>
          <option value="auto">Auto-assign</option>
        </select>
      </div>

      <div>
        <label htmlFor="draft-date" className="mb-2 block text-sm font-medium text-text-primary">
          Draft Date (optional)
        </label>
        <input
          id="draft-date"
          type="date"
          value={draftDate}
          onChange={(event) => onSettingsChange({ draftDate: event.target.value })}
          className="w-full rounded-lg border border-border px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  );
}
