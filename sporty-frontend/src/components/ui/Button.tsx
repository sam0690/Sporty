import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

// Design_System.md §9 — sharp edges, Barlow Condensed uppercase, red is action.
const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-press focus-visible:ring-primary/40",
  secondary:
    "bg-ink text-on-ink hover:bg-ink-block-2 focus-visible:ring-ink/30",
  outline:
    "bg-surface border-[1.5px] border-border-strong text-ink hover:border-ink hover:bg-surface-muted focus-visible:ring-ink/20",
  ghost:
    "bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:ring-ink/15",
  danger:
    "bg-danger text-on-primary hover:bg-primary-press focus-visible:ring-danger/40",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", className, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm font-condensed font-semibold uppercase tracking-[0.06em] leading-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = "Button";
export { Button };
