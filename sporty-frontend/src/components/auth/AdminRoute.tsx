"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/lib/route.config";
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-1-50">
        <div className="h-8 w-8 animate-spin rounded-[3px] border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
