"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui";
import { JoinLeagueSchema, type JoinLeagueValues } from "@/lib/validations";

type JoinFormProps = {
  onSubmit: (inviteCode: string) => Promise<void> | void;
  isLoading: boolean;
  error?: string | null;
};

export function JoinForm({ onSubmit, isLoading, error }: JoinFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinLeagueValues>({
    resolver: zodResolver(JoinLeagueSchema),
    defaultValues: {
      invite_code: "",
    },
    mode: "onSubmit",
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit(values.invite_code.trim());
  });

  return (
    <form
      onSubmit={submit}
      className="animate-fade-in mx-auto max-w-md overflow-hidden rounded-[16px] border border-[rgba(11,18,32,0.1)] bg-gradient-to-b from-[#FFFFFF] to-[#FFFFFF] p-8 shadow-[0_24px_60px_-30px_rgba(0,0,0,1)]"
    >
      {/* key badge */}
      <div className="flex justify-center">
        <span className="grid size-12 place-items-center rounded-[12px] bg-[rgba(220,38,38,0.1)] text-[#DC2626] ring-1 ring-[rgba(220,38,38,0.25)]">
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="4.5" />
            <path d="M11.2 11.2L20 20M17 17l2-2M14 14l2-2" />
          </svg>
        </span>
      </div>

      <div className="mt-5">
        <label
          htmlFor="invite-code"
          className="mb-2 block text-center font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280]"
        >
          Invite Code
        </label>
        <Input
          id="invite-code"
          placeholder="e.g. j4YEA1lf"
          className="w-full rounded-[10px] border border-[rgba(11,18,32,0.12)] bg-[#FFFFFF] px-4 py-3 text-center font-mono text-lg tracking-[0.2em] text-[#0B1220] outline-none transition-colors focus:border-[#DC2626] focus:ring-2 focus:ring-[rgba(220,38,38,0.15)]"
          error={errors.invite_code?.message}
          {...register("invite_code")}
        />
        <p className="mt-2 text-center text-xs text-[#6B7280]">
          Invite codes are case-sensitive.
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-[8px] border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.08)] px-3 py-2 text-sm text-[#DC2626]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#DC2626] px-8 py-3 font-barlow-condensed text-sm font-bold uppercase tracking-[2px] text-[#F6F7F9] shadow-[0_10px_30px_-10px_rgba(220,38,38,0.5)] transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F6F7F9]/30 border-t-[#F6F7F9]" />
            Joining...
          </>
        ) : (
          "Join League"
        )}
      </button>
    </form>
  );
}
