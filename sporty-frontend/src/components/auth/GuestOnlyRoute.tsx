"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/lib/route.config";
import { getSafeRedirectPath } from "@/lib/route.utils";

type GuestOnlyRouteProps = {
  children: ReactNode;
  redirectTo?: string;
};

export function GuestOnlyRoute({
  children,
  redirectTo = ROUTES.DASHBOARD.path,
}: GuestOnlyRouteProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const redirect = getSafeRedirectPath(
        new URLSearchParams(window.location.search).get("redirect"),
      );
      router.replace(redirect ?? redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111117]-50">
        <div className="h-8 w-8 animate-spin rounded-[3px] border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
