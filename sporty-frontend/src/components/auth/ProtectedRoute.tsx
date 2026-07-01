"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/lib/route.config";

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
      router.replace(redirectTo);
    }
  }, [isAllowed, isLoading, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
