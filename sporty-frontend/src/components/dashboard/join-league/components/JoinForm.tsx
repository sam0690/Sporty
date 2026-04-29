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
      className="mx-auto max-w-md space-y-4 rounded-2xl border border-gray-100 bg-white p-8 animate-[fade-soft_0.2s_ease]"
    >
      <div>
        <label
          htmlFor="invite-code"
          className="mb-1 block text-sm text-gray-600"
        >
          Invite Code
        </label>
        <Input
          id="invite-code"
          placeholder="e.g. j4YEA1lf"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center font-mono text-lg tracking-wider text-gray-900 outline-none transition focus:border-primary-400"
          error={errors.invite_code?.message}
          {...register("invite_code")}
        />
        <p className="mt-2 text-center text-xs text-gray-400">
          Invite codes are case-sensitive.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#247BA0] px-8 py-3 font-semibold text-white! shadow-sm transition-colors hover:bg-[#1d6280] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600! disabled:opacity-100"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Joining...
          </>
        ) : (
          "Join League"
        )}
      </button>
    </form>
  );
}
