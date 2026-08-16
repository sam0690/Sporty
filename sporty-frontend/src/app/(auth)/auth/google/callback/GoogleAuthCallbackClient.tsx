"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { GoogleAccountLinkModal } from "@/components/auth/google-link/components/GoogleAccountLinkModal";
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/lib/toastifier";
import {
  buildFavouritesOnboardingUrl,
  getSafeRedirectPath,
  postAuthHomePath,
} from "@/lib/route.utils";

export function GoogleAuthCallbackClient() {
  const router = useRouter();
  const { login, loginWithGoogle, linkGoogle } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [pendingLinkToken, setPendingLinkToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | undefined>();
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [linkError, setLinkError] = useState<string | undefined>();
  const hasStarted = useRef(false);
  const redirectTo = useRef<string | null>(null);

  // Runs exactly once, guarded by the ref. Deliberately has no deps and no
  // "still mounted" check: loginWithGoogle flips the auth context's loading
  // flag synchronously, so any dep on it would tear this effect down mid
  // flight and drop the result — which left the spinner up forever. Every
  // path below navigates or opens the link modal, so there is nothing to
  // clean up.
  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    redirectTo.current = getSafeRedirectPath(params.get("state"));

    // Drop the code from the URL before using it: Google rejects a second
    // exchange of the same code, so a reload of this page must not replay it.
    window.history.replaceState(null, "", window.location.pathname);

    if (!code) {
      toastifier.error("Google authorization code is missing.");
      router.replace("/login");
      return;
    }

    const exchangeCode = async (): Promise<void> => {
      const result = await loginWithGoogle(code);

      if (result.success) {
        window.location.replace(
          result.isNewUser
            ? buildFavouritesOnboardingUrl(redirectTo.current)
            : redirectTo.current ?? postAuthHomePath(result.role),
        );
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

    void exchangeCode().finally(() => setIsProcessing(false));
  }, [loginWithGoogle, router]);

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
      router.replace(redirectTo.current ?? postAuthHomePath(reauthResult.role));
      return;
    }

    setLinkError(result.error ?? "Linking failed. Please try again.");
    setIsReauthenticating(false);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center card-surface px-8 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
      <div className="h-12 w-12 animate-spin rounded-[3px] border-2 border-white/20 border-t-accent" />
      <h1 className="mt-6 text-2xl font-700 text-fg-1">
        Completing Google sign-in
      </h1>
      <p className="mt-3 text-sm leading-6 text-fg-3">
        Please wait while we finish verifying your Google account.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-6 rounded-[3px] border border-white/8 bg-surface-3 px-5 py-2 text-fg-1 transition-all duration-200 hover:bg-white/10"
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
