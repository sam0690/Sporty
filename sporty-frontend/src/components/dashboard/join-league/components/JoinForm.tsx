"use client";

import { useState } from "react";

type JoinFormProps = {
  onSubmit: (inviteCode: string, leagueName?: string) => Promise<void> | void;
  isLoading: boolean;
  error?: string | null;
};

export function JoinForm({ onSubmit, isLoading, error }: JoinFormProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [leagueName, setLeagueName] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(inviteCode.trim().toUpperCase(), leagueName.trim());
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-2xl border border-gray-100 bg-white p-8 [animation:fade-soft_0.2s_ease]">
      <div>
        <label htmlFor="invite-code" className="mb-1 block text-sm text-gray-600">
          Invite Code
        </label>
        <input
          id="invite-code"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
          placeholder="ABCD-1234-EFGH"
          required
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center font-mono text-lg tracking-wider text-gray-900 outline-none transition focus:border-primary-400"
        />
        <p className="mt-2 text-center text-xs text-gray-400">
          Format: XXXX-XXXX-XXXX
        </p>
      </div>

      <div>
        <label htmlFor="league-name" className="mb-1 block text-sm text-gray-600">
          League Name (optional)
        </label>
        <input
          id="league-name"
          value={leagueName}
          onChange={(event) => setLeagueName(event.target.value)}
          placeholder="Search by league name"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none transition focus:border-primary-400"
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#247BA0] px-8 py-3 font-semibold !text-white shadow-sm transition-colors hover:bg-[#1d6280] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:!text-gray-600 disabled:opacity-100"
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
