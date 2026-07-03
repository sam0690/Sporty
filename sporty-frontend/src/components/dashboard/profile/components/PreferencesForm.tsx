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
    <div className="flex items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-3">
      <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
        {label}
      </p>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={`relative h-6 w-11 rounded-full border transition-colors ${
          enabled
            ? "border-[rgba(232,251,37,0.4)] bg-[#e8fb25]"
            : "border-[rgba(255,255,255,0.1)] bg-[#1d1d26]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform ${
            enabled
              ? "translate-x-5 bg-[#0a0a0f]"
              : "translate-x-0.5 bg-[#9a9aa5]"
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
    <section className="card-fade-in overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <header className="border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
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

        <div className="flex items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-3">
          <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
            Language
          </p>
          <select
            value={preferences.language}
            onChange={(event) =>
              updatePreference({ language: event.target.value })
            }
            className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1.5 text-sm text-[#f0f0f0] outline-none transition-colors focus:border-[#e8fb25]"
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
