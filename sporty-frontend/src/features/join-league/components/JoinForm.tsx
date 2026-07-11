"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui";
import { JoinLeagueSchema, type JoinLeagueValues } from "@/lib/validations";

type JoinFormProps = {
  onSubmit: (inviteCode: string) => Promise<void> | void;
  isLoading: boolean;
  error?: string | null;
  defaultInviteCode?: string;
};

export function JoinForm({
  onSubmit,
  isLoading,
  error,
  defaultInviteCode,
}: JoinFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinLeagueValues>({
    resolver: zodResolver(JoinLeagueSchema),
    defaultValues: {
      invite_code: defaultInviteCode ?? "",
    },
    mode: "onSubmit",
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit(values.invite_code.trim());
  });

  return (
    <form
      onSubmit={submit}
      className="animate-fade-in mx-auto max-w-md overflow-hidden card-surface p-8"
    >
      {/* key badge */}
      <div className="flex justify-center">
        <span className="grid size-12 place-items-center rounded-[3px] border border-accent/25 bg-accent/10 text-accent">
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
          className="mb-2 block text-center font-sans text-xs font-700 uppercase tracking-[2px] text-fg-2"
        >
          Invite Code
        </label>
        <Input
          id="invite-code"
          placeholder="e.g. j4YEA1lf"
          className="w-full rounded-[3px] border border-white/12 bg-surface-2 px-4 py-3 text-center font-mono text-lg tracking-[0.2em] text-fg-1 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15"
          error={errors.invite_code?.message}
          {...register("invite_code")}
        />
        <p className="mt-2 text-center text-xs text-fg-3">
          Invite codes are case-sensitive.
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-[3px] border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger-soft">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[3px] bg-accent px-8 py-3 font-sans text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-0/30 border-t-surface-0" />
            Joining...
          </>
        ) : (
          "Join League"
        )}
      </button>
    </form>
  );
}
