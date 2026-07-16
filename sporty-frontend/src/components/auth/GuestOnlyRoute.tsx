"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getSafeRedirectPath, postAuthHomePath } from "@/lib/route.utils";

type GuestOnlyRouteProps = {
  children: ReactNode;
  redirectTo?: string;
};

export function GuestOnlyRoute({ children, redirectTo }: GuestOnlyRouteProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isAuthenticated = Boolean(user);
  const hasSettled = useRef(false);

  useEffect(() => {
    // Only bounce visitors who ARRIVE already authenticated (first settle).
    // Auth completed while on the page (login/signup submit) is navigated by
    // the form itself, which may route through onboarding — don't race it.
    if (isLoading || hasSettled.current) {
      return;
    }
    hasSettled.current = true;
    if (isAuthenticated) {
      const redirect = getSafeRedirectPath(
        new URLSearchParams(window.location.search).get("redirect"),
      );
      router.replace(redirect ?? redirectTo ?? postAuthHomePath(user?.role));
    }
  }, [isAuthenticated, isLoading, redirectTo, router, user?.role]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-1-50">
        <div className="h-8 w-8 animate-spin rounded-[3px] border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
