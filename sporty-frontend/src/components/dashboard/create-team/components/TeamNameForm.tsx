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
    <section className="mx-auto max-w-md space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-foreground">
        Step 2: Name Your Team
      </h2>

      <div>
        <label
          htmlFor="team-name"
          className="mb-1 block text-sm font-medium text-slate-400"
        >
          Team Name
        </label>
        <Input
          id="team-name"
          value={teamName}
          maxLength={30}
          onChange={(event) => onTeamNameChange(event.target.value)}
          placeholder="Enter your team name"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground outline-none focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          error={error ?? undefined}
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {teamName.length}/30
        </p>
      </div>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-foreground hover:bg-white/8"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-4 py-2 font-semibold text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Team"}
        </button>
      </div>
    </section>
  );
}
