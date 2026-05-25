"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useGoogleIdentity } from "@/hooks/auth/useGoogleIdentity";
import { toastifier } from "@/lib/toastifier";

export function SocialLogin() {
  const router = useRouter();
  const { loginWithGoogle, actionLoading } = useAuth();
  const { ready, prompt } = useGoogleIdentity();
  const [linkPrompt, setLinkPrompt] = useState<{
    email?: string;
  } | null>(null);
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
        if (result.code === "account_exists_link_required") {
          setLinkPrompt({ email: result.email });
          toastifier.info(
            "Account exists with a different login method. Sign in with your original method to finish linking Google.",
          );
          return;
        }

        toastifier.error(result.error ?? "Unable to sign in with Google.");
        return;
      }

      router.replace("/dashboard");
    });
  };

  const closeLinkPrompt = () => {
    setLinkPrompt(null);
  };

  return (
    <>
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

      {linkPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1120] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-primary">
              Account linking required
            </p>
            <h3 className="mt-3 text-2xl font-bold text-foreground">
              Account already exists
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {linkPrompt.email
                ? `We found an existing account for ${linkPrompt.email}.`
                : "We found an existing account for this Google email."}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Sign in with your original method, and Google will be linked to
              the same account automatically.
            </p>
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                className="rounded-full px-5 py-2"
                onClick={closeLinkPrompt}
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
