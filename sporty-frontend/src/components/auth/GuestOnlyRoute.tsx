"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/libs/route.config";

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
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
