import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
        "bg-primary text-primary-foreground hover:bg-primary-700 focus-visible:ring-primary",
    secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary-hover focus-visible:ring-secondary",
    outline:
        "border border-surface-300 bg-transparent hover:bg-surface-50 focus-visible:ring-primary",
    ghost:
        "bg-transparent hover:bg-surface-100 focus-visible:ring-primary",
    danger:
        "bg-accent-red text-white hover:bg-red-600 focus-visible:ring-accent-red",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = "primary", size = "md", className, children, ...props }, ref) => (
        <button
            ref={ref}
            className={cn(
                "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
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
