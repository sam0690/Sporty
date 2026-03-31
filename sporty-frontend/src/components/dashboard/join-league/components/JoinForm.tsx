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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="invite-code" className="mb-1 block text-sm font-medium text-text-primary">
          Invite Code
        </label>
        <input
          id="invite-code"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
          placeholder="XXXX-XXXX-XXXX"
          required
          className="w-full rounded-lg border border-border px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="mt-2 text-xs text-text-secondary">
          Enter the 12-character invite code shared by the league commissioner. Example: ABCD-1234-EFGH
        </p>
      </div>

      <div>
        <label htmlFor="league-name" className="mb-1 block text-sm font-medium text-text-primary">
          League Name (optional)
        </label>
        <input
          id="league-name"
          value={leagueName}
          onChange={(event) => setLeagueName(event.target.value)}
          placeholder="Search by league name"
          className="w-full rounded-lg border border-border px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
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
