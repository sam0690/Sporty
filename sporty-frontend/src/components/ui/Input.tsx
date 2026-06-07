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
          "w-full rounded-[3px] border bg-[#111117] px-4 py-3 text-sm text-[#f0f0f0] placeholder:text-[#555560] transition-colors duration-150 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-[#ff3b30] focus:border-[#ff3b30]"
            : "border-[rgba(255,255,255,0.12)] focus:border-[#e8fb25]",
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-[#ff3b30]">{error}</span>}
    </div>
  ),
);

Input.displayName = "Input";
export { Input };
