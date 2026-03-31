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
    <div className="flex items-center justify-between border-b border-border py-3">
      <p className="text-text-primary">{label}</p>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-primary-500" : "bg-surface-300"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

export function PreferencesForm({ preferences, onUpdate }: PreferencesFormProps) {
  const updatePreference = (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch };
    onUpdate(next);
  };

  return (
    <section className="mt-6 border-t border-border pt-6">
      <h2 className="mb-4 text-xl font-semibold text-text-primary">Preferences</h2>

      <div className="rounded-lg border border-border bg-surface-100 px-4">
        <ToggleRow
          label="Email Notifications"
          enabled={preferences.emailNotifications}
          onToggle={() => updatePreference({ emailNotifications: !preferences.emailNotifications })}
        />

        <ToggleRow
          label="Push Notifications"
          enabled={preferences.pushNotifications}
          onToggle={() => updatePreference({ pushNotifications: !preferences.pushNotifications })}
        />

        <ToggleRow
          label="Dark Mode"
          enabled={preferences.darkMode}
          onToggle={() => updatePreference({ darkMode: !preferences.darkMode })}
        />

        <div className="flex items-center justify-between py-3">
          <p className="text-text-primary">Language</p>
          <select
            value={preferences.language}
            onChange={(event) => updatePreference({ language: event.target.value })}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary"
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
