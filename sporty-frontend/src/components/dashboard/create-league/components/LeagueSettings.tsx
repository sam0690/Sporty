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

const fieldLabel =
  "mb-2 block font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280]";
const fieldControl =
  "w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-2.5 text-sm text-[#0B1220] outline-none transition-colors focus:border-[#DC2626]";

function RadioCard({
  selected,
  onSelect,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-[3px] border p-4 text-left transition-colors ${
        selected
          ? "border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.08)]"
          : "border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] hover:border-[rgba(11,18,32,0.18)]"
      }`}
    >
      <span
        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
          selected ? "border-[#DC2626]" : "border-[rgba(11,18,32,0.25)]"
        }`}
      >
        {selected && <span className="size-2 rounded-full bg-[#DC2626]" />}
      </span>
      <span>
        <p
          className={`font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] ${
            selected ? "text-[#DC2626]" : "text-[#0B1220]"
          }`}
        >
          {title}
        </p>
        <p className="mt-1 text-xs text-[#6B7280]">{desc}</p>
      </span>
    </button>
  );
}

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
        <p className={fieldLabel}>League Type</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioCard
            selected={!isPrivate}
            onSelect={() => onSettingsChange({ isPrivate: false })}
            title="Public"
            desc="Anyone can discover and join."
          />
          <RadioCard
            selected={isPrivate}
            onSelect={() => onSettingsChange({ isPrivate: true })}
            title="Private"
            desc="Join with an invite code only."
          />
        </div>
      </div>

      <div>
        <label htmlFor="team-size" className={fieldLabel}>
          Team Size
        </label>
        <select
          id="team-size"
          value={teamSize}
          onChange={(event) =>
            onSettingsChange({ teamSize: Number(event.target.value) })
          }
          className={fieldControl}
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
        <label htmlFor="competition-type" className={fieldLabel}>
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
          className={fieldControl}
          style={{ colorScheme: "dark" }}
        >
          <option value="draft">Draft Mode</option>
          <option value="budget">Budget Mode (Auto Assign)</option>
        </select>
      </div>

      <div>
        <label htmlFor="draft-date" className={fieldLabel}>
          Draft Date (optional)
        </label>
        <input
          id="draft-date"
          type="date"
          value={draftDate}
          onChange={(event) =>
            onSettingsChange({ draftDate: event.target.value })
          }
          className={fieldControl}
          style={{ colorScheme: "dark" }}
        />
      </div>
    </div>
  );
}
