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
                    "flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-surface-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    error
                        ? "border-accent-red focus-visible:ring-accent-red"
                        : "border-surface-300 focus-visible:ring-primary",
                    className,
                )}
                {...props}
            />
            {error && (
                <span className="text-xs text-accent-red">{error}</span>
            )}
        </div>
    ),
);

Input.displayName = "Input";
export { Input };
