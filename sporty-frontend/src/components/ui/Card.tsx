import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

// Design_System.md §6/§9 — white block, 1px border, sharp radius, resting shadow.
const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-md border border-border bg-surface text-ink shadow-sm transition-colors duration-150",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-5 py-4 border-b border-border", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-condensed text-lg font-bold uppercase tracking-[0.02em] leading-none text-ink",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardContent = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-5 py-5 text-ink-soft", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center px-5 py-4 border-t border-border",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
