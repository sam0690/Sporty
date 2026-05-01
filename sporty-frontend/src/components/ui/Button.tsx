import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
        "bg-primary text-[#F4F4F9] font-semibold hover:bg-[#035c3d] shadow-card hover:shadow-hover active:scale-[0.98] focus-visible:ring-primary/50",
    secondary:
        "bg-secondary text-[#F4F4F9] font-semibold hover:bg-[#3f515c] focus-visible:ring-secondary",
    outline:
        "border-2 border-primary text-primary bg-transparent font-semibold hover:bg-primary hover:text-[#F4F4F9] focus-visible:ring-primary/50",
    ghost:
        "text-secondary hover:bg-accent/30 focus-visible:ring-accent",
    danger:
        "bg-danger text-white font-semibold hover:bg-red-700 focus-visible:ring-danger",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = "primary", size = "md", className, children, ...props }, ref) => (
        <button
            ref={ref}
            className={cn(
                "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
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
