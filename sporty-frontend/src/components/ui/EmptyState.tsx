"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
};

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
};

const actionVariantClass: Record<NonNullable<EmptyStateAction["variant"]>, string> = {
  primary: "bg-accent text-surface-0 hover:bg-accent-bright",
  secondary: "border border-white/8 text-fg-2 hover:text-fg-1",
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  className = "",
}: EmptyStateProps) {
  return (
    <section className={`card-surface py-16 text-center ${className}`}>
      {Icon && (
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-white/8 text-fg-3">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      )}
      <h3 className="font-sans text-lg font-700 uppercase tracking-[1px] text-fg-1">
        {title}
      </h3>
      {description && <p className="mt-1 text-sm text-fg-3">{description}</p>}

      {actions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {actions.map((action) => {
            const className = `rounded-[3px] px-6 py-2 font-sans text-xs font-700 uppercase tracking-[2px] transition-colors ${
              actionVariantClass[action.variant ?? "secondary"]
            }`;

            return action.href ? (
              <Link key={action.label} href={action.href} className={className}>
                {action.label}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={className}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export type { EmptyStateAction };
