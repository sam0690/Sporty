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
          variant="outline"
          size="md"
          className={cn(
            "border border-gray-300 bg-white! text-gray-700! hover:border-gray-400 hover:bg-gray-50!",
            mobile && "w-full justify-center",
          )}
        >
          Login
        </Button>
      </Link>
      <Link
        href="/register"
        onClick={onNavigate}
        className={mobile ? "w-full" : undefined}
      >
        <Button
          size="md"
          className={cn(
            "bg-[#247BA0]! text-white! hover:bg-[#1d6280]!",
            mobile && "w-full justify-center",
          )}
        >
          Sign Up
        </Button>
      </Link>
    </div>
  );
}
