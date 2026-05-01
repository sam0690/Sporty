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
        className={cn(mobile ? "w-full" : undefined, "hover:no-underline")}
      >
        <Button
          variant="outline"
          size="md"
          className={cn(
            mobile && "w-full justify-center",
          )}
        >
          Login
        </Button>
      </Link>
      <Link
        href="/register"
        onClick={onNavigate}
        className={cn(mobile ? "w-full" : undefined, "hover:no-underline")}
      >
        <Button
          size="md"
          className={cn(
            mobile && "w-full justify-center",
          )}
        >
          Sign Up
        </Button>
      </Link>
    </div>
  );
}
