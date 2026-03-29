import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

/* ── Card Root ────────────────────────────────────────────────────── */

export interface CardProps extends HTMLAttributes<HTMLDivElement> { }

const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "rounded-lg border border-surface-200 bg-white shadow-card",
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
            className={cn("flex flex-col gap-1.5 p-6", className)}
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
            className={cn("text-lg font-semibold leading-none tracking-tight", className)}
            {...props}
        />
    ),
);
CardTitle.displayName = "CardTitle";

/* ── Card Content ─────────────────────────────────────────────────── */

const CardContent = forwardRef<HTMLDivElement, CardProps>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
    ),
);
CardContent.displayName = "CardContent";

/* ── Card Footer ──────────────────────────────────────────────────── */

const CardFooter = forwardRef<HTMLDivElement, CardProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex items-center p-6 pt-0", className)}
            {...props}
        />
    ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
