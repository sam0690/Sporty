"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useGoogleIdentity } from "@/hooks/auth/useGoogleIdentity";
import { toastifier } from "@/libs/toastifier";

export function SocialLogin() {
  const router = useRouter();
  const { loginWithGoogle, actionLoading } = useAuth();
  const { ready, prompt } = useGoogleIdentity();
  const isSubmitting = actionLoading.google;

  const handleGoogleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toastifier.error("Google client ID is not configured.");
      return;
    }

    if (!ready) {
      toastifier.error("Google login is not ready yet.");
      return;
    }

    prompt(async (idToken) => {
      const result = await loginWithGoogle(idToken);
      if (!result.success) {
        toastifier.error(result.error ?? "Unable to sign in with Google.");
        return;
      }

      router.push("/dashboard");
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        className="rounded-full border border-border-light/80 bg-surface-50/80 px-4 py-3 text-text-primary backdrop-blur-sm transition-colors hover:bg-secondary-50"
        onClick={handleGoogleLogin}
        disabled={isSubmitting}
      >
        <span className="mr-2 text-sm">G</span>
        {isSubmitting ? "Connecting..." : "Google"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="rounded-full border border-border-light/80 bg-surface-50/80 px-4 py-3 text-text-primary backdrop-blur-sm transition-colors hover:bg-secondary-50"
        disabled
      >
        <span className="mr-2 text-sm">GH</span>
        GitHub (Soon)
      </Button>
    </div>
  );
}
