import { Suspense } from "react";
import { GoogleAuthCallbackClient } from "./GoogleAuthCallbackClient";

export default function GoogleAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md flex-col items-center rounded-lg border border-border bg-surface px-8 py-10 text-center shadow-lg">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-border-strong border-t-primary" />
          <h1 className="mt-6 font-condensed text-2xl font-bold uppercase tracking-[0.01em] text-ink">
            Completing Google sign-in
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Please wait while we finish verifying your Google account.
          </p>
        </div>
      }
    >
      <GoogleAuthCallbackClient />
    </Suspense>
  );
}
