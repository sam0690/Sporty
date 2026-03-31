"use client";

import { ReactNode } from "react";
import { FloatingSportsIcons } from "@/components/auth/shared/FloatingSportsIcons";

type AuthPageShellProps = {
  children: ReactNode;
  hero: ReactNode;
};

export function AuthPageShell({ children, hero }: AuthPageShellProps) {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-surface-100 via-surface-50 to-surface-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-20 auth-dot-pattern" />
      <div className="pointer-events-none absolute -top-24 -left-24 -z-10 h-64 w-64 rounded-full bg-primary-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 -z-10 h-72 w-72 rounded-full bg-accent-basketball/20 blur-3xl" />
      <FloatingSportsIcons />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 md:grid-cols-2">
        <div className="w-full">{children}</div>
        {hero}
      </div>
    </section>
  );
}
