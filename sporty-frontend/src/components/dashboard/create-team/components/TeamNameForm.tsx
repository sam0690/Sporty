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
    <section className="mx-auto max-w-md space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-6 ">
      <h2 className="text-xl font-600 text-[#f0f0f0]">
        Step 2: Name Your Team
      </h2>

      <div>
        <label
          htmlFor="team-name"
          className="mb-1 block text-sm text-[#555560]"
        >
          Team Name
        </label>
        <Input
          id="team-name"
          value={teamName}
          maxLength={30}
          onChange={(event) => onTeamNameChange(event.target.value)}
          placeholder="Enter your team name"
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3 text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          error={error ?? undefined}
        />
        <p className="mt-1 text-right text-xs text-[#555560]">
          {teamName.length}/30
        </p>
      </div>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 font-600 text-[#f0f0f0] hover:bg-[#1d1d26]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="rounded-[3px] bg-linear-to-r [#e8fb25] px-4 py-2 font-600 text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Team"}
        </button>
      </div>
    </section>
  );
}
