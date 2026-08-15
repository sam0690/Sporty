"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/lib/route.config";
import { AuthGateSpinner } from "./AuthGateSpinner";

type ProtectedRouteProps = {
  children: ReactNode;
  redirectTo?: string;
};

export function ProtectedRoute({
  children,
  redirectTo = ROUTES.LOGIN.path,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isAllowed = Boolean(user);

  useEffect(() => {
    if (!isLoading && !isAllowed) {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      router.replace(
        `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`,
      );
    }
  }, [isAllowed, isLoading, redirectTo, router]);

  if (isLoading) {
    return <AuthGateSpinner />;
  }

  if (!isAllowed) {
    // Spinner, not null: the redirect above is in flight, and a null render
    // here is a blank page the user is stuck on if it never lands.
    return <AuthGateSpinner />;
  }

  return <>{children}</>;
}
