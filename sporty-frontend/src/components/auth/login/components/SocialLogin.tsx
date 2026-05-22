"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useGoogleIdentity } from "@/hooks/auth/useGoogleIdentity";
import { toastifier } from "@/lib/toastifier";

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

      router.replace("/dashboard");
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-foreground transition-all duration-200 hover:bg-white/10"
        onClick={handleGoogleLogin}
        disabled={isSubmitting}
      >
        <span className="mr-2 text-sm">G</span>
        {isSubmitting ? "Connecting..." : "Google"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-foreground transition-all duration-200 hover:bg-white/10"
        disabled
      >
        <span className="mr-2 text-sm">GH</span>
        GitHub (Soon)
      </Button>
    </div>
  );
}
