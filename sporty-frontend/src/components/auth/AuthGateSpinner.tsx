"use client";

/**
 * Full-screen spinner shown while an auth guard is resolving or redirecting.
 *
 * Guards must never render `null` in those states. A guard that returns null
 * paints a blank page, and if the navigation it is waiting on never lands the
 * user is stranded there with nothing to look at and no way out but a manual
 * refresh — which is exactly the bug this replaced.
 */
export function AuthGateSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1-50">
      <div className="h-8 w-8 animate-spin rounded-[3px] border-2 border-primary border-t-transparent" />
    </div>
  );
}
