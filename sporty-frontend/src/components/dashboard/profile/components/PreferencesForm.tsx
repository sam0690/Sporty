"use client";

type Preferences = {
  emailNotifications: boolean;
  // Push notifications, dark mode, and language are not wired to any
  // backend/theme system yet — their controls are disabled below until
  // that infra exists.
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
    <div className="flex items-center justify-between rounded-[3px] border border-white/8 bg-surface-2 px-4 py-3">
      <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
        {label}
      </p>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={`relative h-6 w-11 rounded-full border transition-colors ${
          enabled
            ? "border-accent/40 bg-accent"
            : "border-white/10 bg-surface-3"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform ${
            enabled
              ? "translate-x-5 bg-surface-0"
              : "translate-x-0.5 bg-fg-2"
          }`}
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
    <section className="card-fade-in overflow-hidden card-surface">
      <header className="border-b border-white/8 px-5 py-3">
        <p className="section-label">Preferences</p>
      </header>

      <div className="space-y-3 p-5">
        <ToggleRow
          label="Email Notifications"
          enabled={preferences.emailNotifications}
          onToggle={() =>
            updatePreference({
              emailNotifications: !preferences.emailNotifications,
            })
          }
        />

        {/*
          Push Notifications, Dark Mode, and Language are disabled until
          their backing infra exists (device-token opt-in, theme system,
          i18n respectively).

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

        <div className="flex items-center justify-between rounded-[3px] border border-white/8 bg-surface-2 px-4 py-3">
          <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
            Language
          </p>
          <select
            value={preferences.language}
            onChange={(event) =>
              updatePreference({ language: event.target.value })
            }
            className="rounded-[3px] border border-white/8 bg-surface-3 px-3 py-1.5 text-sm text-fg-1 outline-none transition-colors focus:border-accent"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>
        */}
      </div>
    </section>
  );
}

export type { Preferences };
