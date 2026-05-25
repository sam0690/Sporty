"use client";

import { Button } from "@/components/ui";
import { toastifier } from "@/lib/toastifier";

export function SocialLogin() {
  const loginWithGoogle = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toastifier.error("Google client ID is not configured.");
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: "https://sporty-woad.vercel.app/auth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-foreground transition-all duration-200 hover:bg-white/10"
        onClick={loginWithGoogle}
      >
        <span className="mr-2 text-sm">G</span>
        Continue with Google
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
