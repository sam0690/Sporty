"use client";

import { ReactNode } from "react";

type AuthPageShellProps = {
  children: ReactNode;
  hero: ReactNode;
};

export function AuthPageShell({ children, hero }: AuthPageShellProps) {
  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0f] px-4 py-8 text-[#f0f0f0] sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 auth-dot-pattern" />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 md:grid-cols-2">
        <div className="w-full">{children}</div>
        {hero}
      </div>
    </section>
  );
}
