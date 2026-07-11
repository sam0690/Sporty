import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-accent text-surface-0 hover:bg-accent-bright focus-visible:ring-accent/50",
  secondary:
    "bg-transparent border border-accent text-accent hover:bg-accent/10 focus-visible:ring-accent/40",
  outline:
    "bg-transparent border border-white/15 text-fg-3 hover:text-fg-1 hover:border-white/25 focus-visible:ring-white/20",
  ghost:
    "bg-transparent border border-white/15 text-fg-3 hover:text-fg-1 hover:border-white/25 focus-visible:ring-white/20",
  danger:
    "bg-[#ff3b30] text-white hover:bg-[#ff5548] focus-visible:ring-[#ff3b30]/50",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", className, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-[3px] border-0 font-barlow-condensed font-700 uppercase tracking-[2px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
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
