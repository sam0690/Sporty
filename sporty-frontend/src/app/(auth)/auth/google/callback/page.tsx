import { Suspense } from "react";
import { GoogleAuthCallbackClient } from "./GoogleAuthCallbackClient";

export default function GoogleAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md flex-col items-center rounded-[3px] border border-white/8 bg-surface-1 px-8 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
          <div className="h-12 w-12 animate-spin rounded-[3px] border-2 border-white/20 border-t-accent" />
          <h1 className="mt-6 text-2xl font-700 text-fg-1">
            Completing Google sign-in
          </h1>
          <p className="mt-3 text-sm leading-6 text-fg-3">
            Please wait while we finish verifying your Google account.
          </p>
        </div>
      }
    >
      <GoogleAuthCallbackClient />
    </Suspense>
  );
}
