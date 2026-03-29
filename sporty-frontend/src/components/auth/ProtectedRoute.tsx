"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/libs/route.config";
import { getLocalStorage } from "@/libs/storage.local";
import { LocalStorageKeys } from "@/libs/storage.kyes";

type ProtectedRouteProps = {
  children: ReactNode;
  redirectTo?: string;
};

export function ProtectedRoute({
  children,
  redirectTo = ROUTES.LOGIN.path,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const hasPersistedToken =
    typeof window !== "undefined" &&
    Boolean(getLocalStorage(LocalStorageKeys.TOKEN));
  const isAllowed = isAuthenticated || hasPersistedToken;

  useEffect(() => {
    if (!isAllowed) {
      router.replace(redirectTo);
    }
  }, [isAllowed, redirectTo, router]);

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
