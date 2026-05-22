import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

/* ── Card Root ────────────────────────────────────────────────────── */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-white/10 bg-gradient-to-b from-surface/95 to-surface-strong/95 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200 hover:border-accent-primary/35 hover:shadow-[0_18px_48px_rgba(0,229,255,0.12)]",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

/* ── Card Header ──────────────────────────────────────────────────── */

const CardHeader = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-6 py-4 border-b border-white/8", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

/* ── Card Title ───────────────────────────────────────────────────── */

const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-display text-lg font-bold leading-none tracking-tight text-foreground",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/* ── Card Content ─────────────────────────────────────────────────── */

const CardContent = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-6 py-5 text-slate-200", className)}
      {...props}
    />
  ),
);
CardContent.displayName = "CardContent";

/* ── Card Footer ──────────────────────────────────────────────────── */

const CardFooter = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center px-6 py-4 border-t border-white/8",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
