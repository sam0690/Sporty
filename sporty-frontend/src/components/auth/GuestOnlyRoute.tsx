"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getSafeRedirectPath, postAuthHomePath } from "@/lib/route.utils";
import { AuthGateSpinner } from "./AuthGateSpinner";

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

  // Cover the page while auth resolves or while we're on our way out, but
  // never by unmounting the children.
  //
  // This is what broke login. `isLoading` is true for the whole login request
  // (auth-context ORs `bootstrapping` with every in-flight action), and
  // `isAuthenticated` flips the moment the session lands — so the old
  // `return null` / early-return-spinner tore this subtree down twice during
  // a single submit. The `router.replace` that leaves /login lives in the
  // form's submit handler INSIDE this subtree, so destroying it mid-flight
  // lost the navigation, and the page sat blank until a manual refresh.
  //
  // `display: contents` keeps the wrapper out of the layout entirely, so the
  // visible case renders exactly as it did before this wrapper existed.
  const isCovered = isLoading || isAuthenticated;

  return (
    <>
      <div style={{ display: isCovered ? "none" : "contents" }}>{children}</div>
      {isCovered && <AuthGateSpinner />}
    </>
  );
}
