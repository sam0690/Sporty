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
    <div className="flex items-center justify-between rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-3">
      <p className="font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
        {label}
      </p>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={`relative h-6 w-11 rounded-full border transition-colors ${
          enabled
            ? "border-[rgba(220,38,38,0.4)] bg-[#DC2626]"
            : "border-[rgba(11,18,32,0.1)] bg-[#F3F4F7]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform ${
            enabled
              ? "translate-x-5 bg-[#F6F7F9]"
              : "translate-x-0.5 bg-[#6B7280]"
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
    <section className="card-fade-in overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
      <header className="border-b border-[rgba(11,18,32,0.08)] px-5 py-3">
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

        <div className="flex items-center justify-between rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-3">
          <p className="font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
            Language
          </p>
          <select
            value={preferences.language}
            onChange={(event) =>
              updatePreference({ language: event.target.value })
            }
            className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-3 py-1.5 text-sm text-[#0B1220] outline-none transition-colors focus:border-[#DC2626]"
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
