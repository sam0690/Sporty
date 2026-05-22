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
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-sm text-slate-300">{label}</p>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-linear-to-r from-accent-primary to-accent-secondary" : "bg-white/10"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`}
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
    <section className="card-fade-in space-y-4 rounded-[1.75rem] border border-white/10 bg-surface/80 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <h2 className="text-md font-semibold text-foreground">Preferences</h2>

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
          <p className="text-sm text-slate-400">Language</p>
          <select
            value={preferences.language}
            onChange={(event) =>
              updatePreference({ language: event.target.value })
            }
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none"
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
