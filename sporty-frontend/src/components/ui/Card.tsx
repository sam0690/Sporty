import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

/* ── Card Root ────────────────────────────────────────────────────── */

export interface CardProps extends HTMLAttributes<HTMLDivElement> { }

const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "bg-white rounded-lg shadow-card hover:shadow-hover transition-all duration-200 border border-accent/30",
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
            className={cn("px-6 py-4 border-b border-accent/20", className)}
            {...props}
        />
    ),
);
CardHeader.displayName = "CardHeader";

/* ── Card Title ───────────────────────────────────────────────────── */

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3
            ref={ref}
            className={cn("font-display text-lg font-bold leading-none tracking-tight text-black", className)}
            {...props}
        />
    ),
);
CardTitle.displayName = "CardTitle";

/* ── Card Content ─────────────────────────────────────────────────── */

const CardContent = forwardRef<HTMLDivElement, CardProps>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("px-6 py-5", className)} {...props} />
    ),
);
CardContent.displayName = "CardContent";

/* ── Card Footer ──────────────────────────────────────────────────── */

const CardFooter = forwardRef<HTMLDivElement, CardProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex items-center px-6 py-4 border-t border-accent/20", className)}
            {...props}
        />
    ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
