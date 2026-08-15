"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/lib/route.config";
import { AuthGateSpinner } from "./AuthGateSpinner";
import { hasMinRole, type UserRole } from "@/lib/roles";

type AdminRouteProps = {
  children: ReactNode;
  /** Minimum admin tier required to view this route. Defaults to "support". */
  minRole?: UserRole;
  redirectTo?: string;
};

export function AdminRoute({
  children,
  minRole = "support",
  redirectTo = ROUTES.DASHBOARD.path,
}: AdminRouteProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isAllowed = Boolean(user) && hasMinRole(user?.role, minRole);

  useEffect(() => {
    if (!isLoading && !isAllowed) {
      router.replace(redirectTo);
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
