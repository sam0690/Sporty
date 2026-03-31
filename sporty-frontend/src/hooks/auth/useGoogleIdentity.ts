"use client";

import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_ID = "google-identity";

const loadGoogleScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Identity is not available on the server."));
      return;
    }

    if (document.getElementById(GOOGLE_SCRIPT_ID)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });
};

export type GoogleIdentityResult = {
  ready: boolean;
  prompt: (onToken: (idToken: string) => void) => void;
};

export function useGoogleIdentity(): GoogleIdentityResult {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadGoogleScript()
      .then(() => {
        if (isMounted) {
          setReady(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const prompt = useCallback(
    (onToken: (idToken: string) => void) => {
      if (!ready) {
        return;
      }

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId || !window.google?.accounts?.id) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            onToken(response.credential);
          }
        },
      });

      window.google.accounts.id.prompt();
    },
    [ready],
  );

  return { ready, prompt };
}
