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
          "w-full rounded-[3px] border bg-surface-1 px-4 py-3 text-sm text-fg-1 placeholder:text-fg-3 transition-colors duration-150 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-danger focus:border-danger"
            : "border-white/12 focus:border-accent",
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  ),
);

Input.displayName = "Input";
export { Input };
