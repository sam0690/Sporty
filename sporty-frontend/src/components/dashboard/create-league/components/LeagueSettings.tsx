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
        <p className="mb-2 text-sm text-slate-400">League Type</p>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-accent-primary/20 hover:bg-white/8">
            <input
              type="radio"
              name="league-type"
              checked={!isPrivate}
              onChange={() => onSettingsChange({ isPrivate: false })}
              className="mt-0.5 h-4 w-4 border-white/10 text-accent-primary"
            />
            <span>
              <p className="text-sm font-medium text-foreground">Public</p>
              <p className="mt-1 text-xs text-slate-400">Anyone can join.</p>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-accent-primary/20 hover:bg-white/8">
            <input
              type="radio"
              name="league-type"
              checked={isPrivate}
              onChange={() => onSettingsChange({ isPrivate: true })}
              className="mt-0.5 h-4 w-4 border-white/10 text-accent-primary"
            />
            <span>
              <p className="text-sm font-medium text-foreground">Private</p>
              <p className="mt-1 text-xs text-slate-400">Invite code only.</p>
            </span>
          </label>
        </div>
      </div>

      <div>
        <label
          htmlFor="team-size"
          className="mb-2 block text-sm text-slate-400"
        >
          Team Size
        </label>
        <select
          id="team-size"
          value={teamSize}
          onChange={(event) =>
            onSettingsChange({ teamSize: Number(event.target.value) })
          }
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground outline-none transition-all focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
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
          className="mb-2 block text-sm text-slate-400"
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
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground outline-none transition-all focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
        >
          <option value="draft">Draft Mode</option>
          <option value="budget">Budget Mode (Auto Assign)</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="draft-date"
          className="mb-2 block text-sm text-slate-400"
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
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground outline-none transition-all focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
        />
      </div>
    </div>
  );
}
