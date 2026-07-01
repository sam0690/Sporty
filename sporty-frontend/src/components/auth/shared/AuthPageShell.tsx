"use client";

import { ReactNode } from "react";

type AuthPageShellProps = {
  children: ReactNode;
  hero: ReactNode;
};

// Two-column auth layout: form on the left, branded broadcast panel on the
// right. The full-screen dark background + dot pattern come from the (auth)
// route layout, so this only owns the centred grid.
export function AuthPageShell({ children, hero }: AuthPageShellProps) {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
      <div className="flex items-center">{children}</div>
      <div className="hidden lg:block">{hero}</div>
    </div>
  );
}
