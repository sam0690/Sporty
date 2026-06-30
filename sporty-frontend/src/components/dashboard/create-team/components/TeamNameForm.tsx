"use client";

import { ArrowLeft, Check } from "lucide-react";
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
    <section className="mx-auto max-w-md space-y-5 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6">
      <div>
        <p className="section-label">Step 2</p>
        <h2 className="mt-1 font-bebas text-3xl leading-none tracking-[2px] text-[#f0f0f0]">
          Name Your Team
        </h2>
      </div>

      <div>
        <label htmlFor="team-name" className="section-label">
          Team Name
        </label>
        <Input
          id="team-name"
          value={teamName}
          maxLength={30}
          onChange={(event) => onTeamNameChange(event.target.value)}
          placeholder="Enter your team name"
          className="mt-2 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-3 text-[#f0f0f0] outline-none transition-colors focus:border-[#e8fb25]"
          error={error ?? undefined}
        />
        <p className="mt-1.5 text-right font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
          {teamName.length}/30
        </p>
      </div>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-5 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0]"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#e8fb25] px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#f2ff5a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check size={15} />
          {isSaving ? "Saving…" : "Save Team"}
        </button>
      </div>
    </section>
  );
}
