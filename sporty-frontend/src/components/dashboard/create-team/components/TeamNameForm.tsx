"use client";

import { Input } from "@/components/ui";

type TeamNameFormProps = {
  teamName: string;
  onTeamNameChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSaving?: boolean;
  error?: string | null;
};

export function TeamNameForm({
  teamName,
  onTeamNameChange,
  onSubmit,
  onBack,
  isSaving = false,
  error,
}: TeamNameFormProps) {
  return (
    <section className="mx-auto max-w-md space-y-4 rounded-lg bg-surface-100 p-6 shadow-card">
      <h2 className="text-xl font-semibold text-text-primary">
        Step 2: Name Your Team
      </h2>

      <div>
        <label
          htmlFor="team-name"
          className="mb-1 block text-sm font-medium text-text-primary"
        >
          Team Name
        </label>
        <Input
          id="team-name"
          value={teamName}
          maxLength={30}
          onChange={(event) => onTeamNameChange(event.target.value)}
          placeholder="Enter your team name"
          className="w-full rounded-lg border border-border px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary-500"
          error={error ?? undefined}
        />
        <p className="mt-1 text-right text-xs text-text-secondary">
          {teamName.length}/30
        </p>
      </div>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-primary-500 px-4 py-2 font-semibold text-primary-500 hover:bg-primary-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="rounded-lg bg-primary-500 px-4 py-2 font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Team"}
        </button>
      </div>
    </section>
  );
}
