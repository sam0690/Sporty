"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { GoogleAccountLinkModal } from "@/components/auth/google-link/components/GoogleAccountLinkModal";
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/lib/toastifier";

export function GoogleAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle, linkGoogle, isLoading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [pendingLinkToken, setPendingLinkToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | undefined>();
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [linkError, setLinkError] = useState<string | undefined>();
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
        if (result.linkToken) {
          setPendingLinkToken(result.linkToken);
          setPendingEmail(result.email);
          setLinkError(undefined);
          setIsLinkModalOpen(true);
          return;
        }

        toastifier.error(
          "Linking is required, but the link token is missing. Please try again.",
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

  const closeLinkModal = () => {
    if (isReauthenticating) {
      return;
    }

    setIsLinkModalOpen(false);
    setPendingLinkToken("");
    setPendingEmail(undefined);
    setLinkError(undefined);
    router.replace("/login");
  };

  const confirmLinkAccount = async (password: string) => {
    if (!pendingLinkToken || isReauthenticating) {
      return;
    }

    const email = pendingEmail?.trim();
    if (!email) {
      setLinkError(
        "Missing account email. Please restart the Google sign-in flow.",
      );
      return;
    }

    setIsReauthenticating(true);
    setLinkError(undefined);

    const reauthResult = await login(email, password);

    if (!reauthResult.success) {
      setLinkError(reauthResult.error ?? "Invalid password. Please try again.");
      setIsReauthenticating(false);
      return;
    }

    const result = await linkGoogle(pendingLinkToken);

    if (result.success) {
      setIsLinkModalOpen(false);
      setPendingLinkToken("");
      setPendingEmail(undefined);
      setLinkError(undefined);
      router.replace("/dashboard");
      return;
    }

    setLinkError(result.error ?? "Linking failed. Please try again.");
    setIsReauthenticating(false);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-8 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
      <div className="h-12 w-12 animate-spin rounded-[3px] border-2 border-white/20 border-t-accent-primary" />
      <h1 className="mt-6 text-2xl font-700 text-[#f0f0f0]">
        Completing Google sign-in
      </h1>
      <p className="mt-3 text-sm leading-6 text-[#555560]">
        Please wait while we finish verifying your Google account.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-6 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-5 py-2 text-[#f0f0f0] transition-all duration-200 hover:bg-white/10"
        onClick={() => router.replace("/login")}
        disabled={isProcessing || isReauthenticating}
      >
        Return to login
      </Button>

      <GoogleAccountLinkModal
        isOpen={isLinkModalOpen}
        email={pendingEmail}
        isLoading={isReauthenticating}
        onClose={closeLinkModal}
        onConfirm={confirmLinkAccount}
        errorMessage={linkError}
      />
    </div>
  );
}
