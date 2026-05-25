"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/lib/toastifier";

export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGoogle, isLoading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (isLoading || hasStarted.current) {
      return;
    }

    const code = searchParams.get("code");

    if (!code) {
      toastifier.error("Google authorization code is missing.");
      router.replace("/login");
      return;
    }

    hasStarted.current = true;
    let isMounted = true;

    const exchangeCode = async (): Promise<void> => {
      const result = await loginWithGoogle(code);
      if (!isMounted) {
        return;
      }

      if (result.success) {
        router.replace("/dashboard");
        return;
      }

      if (result.code === "account_exists_link_required") {
        toastifier.info(
          "Account exists with a different login method. Sign in with your original account to finish linking Google.",
        );
        router.replace("/login");
        return;
      }

      toastifier.error(result.error ?? "Google sign-in failed.");
      router.replace("/login");
    };

    void exchangeCode().finally(() => {
      if (isMounted) {
        setIsProcessing(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isLoading, loginWithGoogle, router, searchParams]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-white/10 bg-surface/90 px-8 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-accent-primary" />
      <h1 className="mt-6 text-2xl font-bold text-foreground">
        Completing Google sign-in
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Please wait while we finish verifying your Google account.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-6 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-foreground transition-all duration-200 hover:bg-white/10"
        onClick={() => router.replace("/login")}
        disabled={isProcessing}
      >
        Return to login
      </Button>
    </div>
  );
}
