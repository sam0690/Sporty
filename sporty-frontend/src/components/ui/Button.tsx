import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-gradient-to-r from-accent-primary via-cyan-400 to-accent-secondary text-background font-semibold shadow-glow hover:brightness-110 active:scale-[0.98] focus-visible:ring-accent-primary/50",
  secondary:
    "bg-surface-strong text-foreground font-semibold border border-white/10 hover:border-accent-primary/40 hover:bg-surface/90 focus-visible:ring-accent-secondary/50",
  outline:
    "border border-accent-primary/60 text-accent-primary bg-transparent font-semibold hover:bg-accent-primary/10 hover:text-foreground focus-visible:ring-accent-primary/50",
  ghost:
    "text-slate-300 hover:bg-white/6 hover:text-foreground focus-visible:ring-accent-primary/40",
  danger:
    "bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold shadow-[0_0_24px_rgba(239,68,68,0.18)] hover:brightness-110 focus-visible:ring-red-500/50",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm",
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
        "inline-flex items-center justify-center rounded-full border border-transparent px-4 py-2.5 font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
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
