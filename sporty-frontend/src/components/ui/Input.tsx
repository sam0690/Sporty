import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/classUtils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

// Design_System.md §9 — white field, strong border, red focus ring.
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full rounded-sm border-[1.5px] bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-danger focus:border-danger focus:ring-danger/30"
            : "border-border-strong focus:border-primary",
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </div>
  ),
);

Input.displayName = "Input";
export { Input };
