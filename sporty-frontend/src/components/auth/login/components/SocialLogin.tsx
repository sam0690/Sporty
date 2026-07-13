"use client";

import { Button } from "@/components/ui";
import { toastifier } from "@/lib/toastifier";
import { getSafeRedirectPath } from "@/lib/route.utils";

export function SocialLogin() {
  const loginWithGoogle = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toastifier.error("Google client ID is not configured.");
      return;
    }

    const redirect = getSafeRedirectPath(
      new URLSearchParams(window.location.search).get("redirect"),
    );

    const params = new URLSearchParams({
      client_id: clientId,
      // Must EXACTLY match an authorized redirect URI in Google console AND
      // the backend's GOOGLE_REDIRECT_URI (used again in the code exchange).
      // Deriving from the page origin keeps it correct per environment
      // (sportyyy.tech in prod, localhost:3000 in dev).
      redirect_uri: `${window.location.origin}/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
      ...(redirect ? { state: redirect } : {}),
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-[3px] border border-white/12 bg-white/3 px-4 text-fg-1 normal-case tracking-normal transition-colors hover:border-white/25 hover:bg-white/6"
        onClick={loginWithGoogle}
      >
        <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
          />
        </svg>
        Google
      </Button>
    </div>
  );
}
