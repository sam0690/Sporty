import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/classUtils";

type NavActionsProps = {
  mobile?: boolean;
  onNavigate?: () => void;
};

export function NavActions({ mobile = false, onNavigate }: NavActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        mobile ? "w-full flex-col" : "hidden md:flex",
      )}
    >
      <Link
        href="/login"
        onClick={onNavigate}
        className={mobile ? "w-full" : undefined}
      >
        <Button
          variant="ghost"
          size="md"
          className={cn(
            "text-surface-700 hover:text-primary",
            mobile && "w-full justify-center",
          )}
        >
          Sign in
        </Button>
      </Link>
      <Link
        href="/signUp"
        onClick={onNavigate}
        className={mobile ? "w-full" : undefined}
      >
        <Button
          size="md"
          className={mobile ? "w-full justify-center" : undefined}
        >
          Get Started
        </Button>
      </Link>
    </div>
  );
}
