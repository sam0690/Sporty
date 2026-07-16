"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/classUtils";
import { useAuth } from "@/context/auth-context";

type NavActionsProps = {
  mobile?: boolean;
  onNavigate?: () => void;
};

// Auth-aware: signed-in users get a single "Dashboard" action instead of
// Login/Sign Up (the public shell also hosts /fixtures, which members visit).
export function NavActions({ mobile = false, onNavigate }: NavActionsProps) {
  const { user } = useAuth();

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        mobile ? "w-full flex-col" : "hidden md:flex",
      )}
    >
      {user ? (
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn(mobile ? "w-full" : undefined, "hover:no-underline")}
        >
          <Button size="md" className={cn(mobile && "w-full justify-center")}>
            Dashboard
          </Button>
        </Link>
      ) : (
        <>
          <Link
            href="/login"
            onClick={onNavigate}
            className={cn(mobile ? "w-full" : undefined, "hover:no-underline")}
          >
            <Button
              variant="outline"
              size="md"
              className={cn(mobile && "w-full justify-center")}
            >
              Login
            </Button>
          </Link>
          <Link
            href="/register"
            onClick={onNavigate}
            className={cn(mobile ? "w-full" : undefined, "hover:no-underline")}
          >
            <Button size="md" className={cn(mobile && "w-full justify-center")}>
              Sign Up
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
