import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, error, ...props }, ref) => (
        <div className="flex flex-col gap-1">
            <input
                ref={ref}
                className={cn(
                    "w-full rounded-md border bg-white px-4 py-3 text-sm text-black placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:border-primary transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                    error
                        ? "border-danger focus:ring-danger/40"
                        : "border-border focus:ring-primary/40",
                    className,
                )}
                {...props}
            />
            {error && (
                <span className="text-xs text-danger">{error}</span>
            )}
        </div>
    ),
);

Input.displayName = "Input";
export { Input };
