"use client";

type Preferences = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  darkMode: boolean;
  language: string;
};

type PreferencesFormProps = {
  preferences: Preferences;
  onUpdate: (nextPreferences: Preferences) => Promise<void> | void;
};

type ToggleRowProps = {
  label: string;
  enabled: boolean;
  onToggle: () => void;
};

function ToggleRow({ label, enabled, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3">
      <p className="text-sm text-[#f0f0f0]">{label}</p>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-linear-to-r [#e8fb25]" : "bg-[#1d1d26]"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-[3px] bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

export function PreferencesForm({
  preferences,
  onUpdate,
}: PreferencesFormProps) {
  const updatePreference = (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch };
    onUpdate(next);
  };

  return (
    <section className="card-fade-in space-y-4 rounded-[1.75rem] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6 ">
      <h2 className="text-md font-600 text-[#f0f0f0]">Preferences</h2>

      <div className="space-y-4">
        <ToggleRow
          label="Email Notifications"
          enabled={preferences.emailNotifications}
          onToggle={() =>
            updatePreference({
              emailNotifications: !preferences.emailNotifications,
            })
          }
        />

        <ToggleRow
          label="Push Notifications"
          enabled={preferences.pushNotifications}
          onToggle={() =>
            updatePreference({
              pushNotifications: !preferences.pushNotifications,
            })
          }
        />

        <ToggleRow
          label="Dark Mode"
          enabled={preferences.darkMode}
          onToggle={() => updatePreference({ darkMode: !preferences.darkMode })}
        />

        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-[#555560]">Language</p>
          <select
            value={preferences.language}
            onChange={(event) =>
              updatePreference({ language: event.target.value })
            }
            className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-sm text-[#f0f0f0] outline-none"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>
      </div>
    </section>
  );
}

export type { Preferences };
