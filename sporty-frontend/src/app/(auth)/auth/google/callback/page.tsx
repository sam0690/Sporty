import { Suspense } from "react";
import { GoogleAuthCallbackClient } from "./GoogleAuthCallbackClient";

export default function GoogleAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-white/10 bg-surface/90 px-8 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-accent-primary" />
          <h1 className="mt-6 text-2xl font-bold text-foreground">
            Completing Google sign-in
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Please wait while we finish verifying your Google account.
          </p>
        </div>
      }
    >
      <GoogleAuthCallbackClient />
    </Suspense>
  );
}
