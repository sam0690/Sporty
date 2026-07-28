"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SportyMark } from "@/components/ui/SportyMark";

// Card shell for the auth forms: back-to-home link, surface, header rhythm.
// Title/description only — no eyebrow; the card is compact and task-focused.
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-sans text-xs font-700 uppercase tracking-[2px] text-fg-3 transition-colors hover:text-fg-1 hover:no-underline"
      >
        ← Back to Home
      </Link>

      <div className="animate-fade-in mt-5 overflow-hidden card-surface">
        <div className="space-y-2 p-8 pb-4">
          <SportyMark className="mb-3 size-9 text-accent" />
          <h1 className="font-display text-4xl leading-none tracking-[-0.02em] text-fg-1">
            {title}
          </h1>
          <p className="text-sm text-fg-2">{description}</p>
        </div>
        <div className="space-y-5 p-8 pt-2">{children}</div>
      </div>
    </div>
  );
}

// The uppercase accent link used for cross-links between auth pages
// ("Create account", "Sign in", "Back to Login").
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-sans text-xs font-700 uppercase tracking-[2px] text-accent transition-colors hover:text-accent-bright hover:no-underline"
    >
      {children}
    </Link>
  );
}
