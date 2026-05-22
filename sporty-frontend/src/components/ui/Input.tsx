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
          "w-full rounded-xl border border-white/10 bg-surface/90 px-4 py-3 text-sm text-foreground placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 focus:border-accent-primary/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-danger focus:ring-danger/40"
            : "border-border-light focus:ring-accent-primary/20",
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  ),
);

Input.displayName = "Input";
export { Input };
