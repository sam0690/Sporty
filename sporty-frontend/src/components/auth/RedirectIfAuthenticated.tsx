"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/lib/route.config";

type RedirectIfAuthenticatedProps = {
  to?: string;
};

// Unlike GuestOnlyRoute (which gates /login, /register behind a loading
// spinner until auth resolves), this renders nothing and never blocks its
// parent page — meant for the public landing page, which should keep its
// fast, unauthenticated-by-default render (SEO/LCP) and only redirect away
// once the client confirms there's an active session.
export function RedirectIfAuthenticated({
  to = ROUTES.DASHBOARD.path,
}: RedirectIfAuthenticatedProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(to);
    }
  }, [isLoading, user, to, router]);

  return null;
}
