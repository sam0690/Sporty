"use client";

type LeagueSettingsData = {
  leagueName: string;
  sport: "football" | "basketball" | "cricket" | "multisport";
  isPrivate: boolean;
  teamSize: number;
  draftType: "snake" | "auction" | "auto";
  draftDate: string;
  matchesStarted: boolean;
};

type SettingsFormProps = {
  data: LeagueSettingsData;
  onChange: (next: Partial<LeagueSettingsData>) => void;
};

export function SettingsForm({ data, onChange }: SettingsFormProps) {
  return (
    <section className="space-y-6 rounded-2xl border border-gray-100 bg-white p-5">
      <h3 className="text-sm font-medium text-gray-900">League Settings</h3>

      <div>
        <label className="mb-1 block text-sm text-gray-600">League Name</label>
        <input
          value={data.leagueName}
          maxLength={50}
          onChange={(event) => onChange({ leagueName: event.target.value })}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 outline-none focus:border-primary-400"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-gray-600">Sport</label>
        <select
          value={data.sport}
          disabled={data.matchesStarted}
          onChange={(event) => onChange({ sport: event.target.value as LeagueSettingsData["sport"] })}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 outline-none focus:border-primary-400 disabled:bg-gray-100"
        >
          <option value="football">Football</option>
          <option value="basketball">Basketball</option>
          <option value="cricket">Cricket</option>
          <option value="multisport">Multi-Sport</option>
        </select>
        {data.matchesStarted ? <p className="mt-1 text-xs text-amber-600">Sport cannot be changed after matches start.</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm text-gray-600">League Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ isPrivate: false })}
            className={`rounded-full border px-4 py-2 text-sm ${!data.isPrivate ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-600"}`}
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => onChange({ isPrivate: true })}
            className={`rounded-full border px-4 py-2 text-sm ${data.isPrivate ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-600"}`}
          >
            Private
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Team Size</label>
          <select
            value={data.teamSize}
            onChange={(event) => onChange({ teamSize: Number(event.target.value) })}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 outline-none focus:border-primary-400"
          >
            {[4, 6, 8, 10, 12, 14, 16].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Draft Type</label>
          <select
            value={data.draftType}
            onChange={(event) => onChange({ draftType: event.target.value as LeagueSettingsData["draftType"] })}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 outline-none focus:border-primary-400"
          >
            <option value="snake">Snake Draft</option>
            <option value="auction">Auction</option>
            <option value="auto">Auto-assign</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-gray-600">Draft Date (optional)</label>
        <input
          type="date"
          value={data.draftDate}
          onChange={(event) => onChange({ draftDate: event.target.value })}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 outline-none focus:border-primary-400"
        />
      </div>
    </section>
  );
}

export type { LeagueSettingsData };
