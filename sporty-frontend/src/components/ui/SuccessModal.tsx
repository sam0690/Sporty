"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

type SuccessModalAction = {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "tertiary";
};

type SuccessModalProps = {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  /** Domain-specific content between the title and the action buttons. */
  children?: ReactNode;
  actions: SuccessModalAction[];
  tone?: "accent" | "success";
};

const variantClass: Record<NonNullable<SuccessModalAction["variant"]>, string> = {
  primary:
    "bg-accent text-black hover:bg-accent-bright",
  secondary:
    "border border-white/8 bg-surface-3 text-fg-1 hover:border-accent/30",
  tertiary: "text-fg-3 hover:text-fg-2",
};

export function SuccessModal({
  open,
  onClose,
  eyebrow,
  title,
  children,
  actions,
  tone = "accent",
}: SuccessModalProps) {
  return (
    <Modal isOpen={open} onClose={onClose} title={title}>
      <div className="-m-6 overflow-hidden">
        <div className={`h-1 ${tone === "success" ? "bg-success" : "bg-accent"}`} />

        <div className="p-6 text-center">
          <div
            className={`mx-auto grid size-14 place-items-center rounded-full border ${
              tone === "success"
                ? "border-success/35 bg-success/10 text-success"
                : "border-accent/30 bg-accent/12 text-accent"
            }`}
          >
            <Check size={26} strokeWidth={3} />
          </div>

          <p className="section-label mt-4">{eyebrow}</p>
          <h2 className="mt-1 font-display text-4xl leading-none tracking-[-0.02em] text-fg-1">
            {title}
          </h2>

          {children && <div className="mt-5 text-left">{children}</div>}

          <div className="mt-6 space-y-2">
            {actions.map((action) => {
              const Icon = action.icon;
              const className = `flex w-full items-center justify-center gap-2 rounded-[3px] px-6 py-2.5 font-sans text-sm font-700 uppercase tracking-[1.5px] transition-colors ${
                variantClass[action.variant ?? "secondary"]
              }`;

              return action.href ? (
                <Link key={action.label} href={action.href} className={className}>
                  {Icon && <Icon size={16} />}
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={className}
                >
                  {Icon && <Icon size={16} />}
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export type { SuccessModalAction };
