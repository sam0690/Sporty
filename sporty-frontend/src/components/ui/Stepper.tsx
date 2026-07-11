"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

type StepperProps = {
  steps: string[];
  /** 1-indexed active step. */
  active: number;
  className?: string;
};

export function Stepper({ steps, active, className = "" }: StepperProps) {
  const prefersReducedMotion = useReducedMotion();
  const clampedActive = Math.min(Math.max(active, 1), steps.length);

  return (
    <div className={`flex items-center ${className}`} aria-label="Progress">
      {steps.map((label, index) => {
        const n = index + 1;
        const isDone = n < clampedActive;
        const isActive = n === clampedActive;

        return (
          <Fragment key={label}>
            <div className="flex items-center gap-2">
              <motion.span
                animate={prefersReducedMotion ? undefined : { scale: isActive ? 1.12 : 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
                aria-current={isActive ? "step" : undefined}
                className={`grid size-7 shrink-0 place-items-center rounded-full border font-display text-sm leading-none ${
                  isDone
                    ? "border-accent bg-accent text-surface-0"
                    : isActive
                      ? "border-accent bg-accent/12 text-accent"
                      : "border-white/12 bg-surface-3 text-fg-3"
                }`}
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : n}
              </motion.span>
              <span
                className={`hidden font-sans text-xs font-700 uppercase tracking-[1.5px] sm:inline ${
                  isActive ? "text-accent" : isDone ? "text-fg-1" : "text-fg-3"
                }`}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span className="relative mx-2 h-px flex-1 overflow-hidden bg-white/10">
                <motion.span
                  className="absolute inset-y-0 left-0 w-full origin-left bg-accent/40"
                  initial={false}
                  animate={{ scaleX: isDone ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
