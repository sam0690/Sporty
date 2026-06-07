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
      className="mx-auto max-w-md space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-8  animate-[fade-soft_0.2s_ease]"
    >
      <div>
        <label
          htmlFor="invite-code"
          className="mb-1 block text-sm text-[#555560]"
        >
          Invite Code
        </label>
        <Input
          id="invite-code"
          placeholder="e.g. j4YEA1lf"
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3 text-center font-mono text-lg tracking-wider text-[#f0f0f0] outline-none transition focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          error={errors.invite_code?.message}
          {...register("invite_code")}
        />
        <p className="mt-2 text-center text-xs text-[#555560]">
          Invite codes are case-sensitive.
        </p>
      </div>

      {error ? (
        <p className="rounded-[3px] border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[3px] bg-linear-to-r [#e8fb25] px-8 py-3 font-600 text-slate-950  transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-[3px] border-2 border-slate-950/30 border-t-slate-950" />
            Joining...
          </>
        ) : (
          "Join League"
        )}
      </button>
    </form>
  );
}
