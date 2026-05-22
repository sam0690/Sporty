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
      className="mx-auto max-w-md space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl animate-[fade-soft_0.2s_ease]"
    >
      <div>
        <label
          htmlFor="invite-code"
          className="mb-1 block text-sm text-slate-400"
        >
          Invite Code
        </label>
        <Input
          id="invite-code"
          placeholder="e.g. j4YEA1lf"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-lg tracking-wider text-foreground outline-none transition focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          error={errors.invite_code?.message}
          {...register("invite_code")}
        />
        <p className="mt-2 text-center text-xs text-slate-500">
          Invite codes are case-sensitive.
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-8 py-3 font-semibold text-slate-950 shadow-[0_16px_40px_rgba(0,229,255,0.18)] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
            Joining...
          </>
        ) : (
          "Join League"
        )}
      </button>
    </form>
  );
}
