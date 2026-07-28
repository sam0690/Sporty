"use client";

import { useEffect, useState } from "react";

// First-load brand moment: the Convergence resolve. Three sport strokes
// (football / basketball / cricket) slide into the node and settle to gold as
// the S draws itself — the same motion as the live "pulse on the play".
//
// Rendered from SSR so it covers content from the first paint (no flash), then
// dismisses itself via CSS (`splash-fade`) even without JS. This timer only
// removes it from the DOM once the animation is done. Mounted once in the root
// providers, so it plays on full document loads, not on client-side navigation.
const SPLASH_MS = 1900;

export function BrandSplash() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;

  return (
    <div className="brand-splash" aria-hidden="true">
      <svg
        viewBox="0 0 96 96"
        className="h-24 w-24"
        fill="none"
        style={{
          filter:
            "drop-shadow(0 0 44px color-mix(in oklab, var(--accent) 30%, transparent))",
        }}
      >
        <path
          className="conv-path"
          d="M66 30 C66 18 30 18 30 34 C30 46 66 50 66 62 C66 78 30 78 30 66"
          stroke="var(--accent)"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <circle className="conv-dot conv-df" cx="48" cy="48" r="6" fill="var(--football)" />
        <circle className="conv-dot conv-db" cx="48" cy="48" r="6" fill="var(--basketball)" />
        <circle className="conv-dot conv-dc" cx="48" cy="48" r="6" fill="var(--cricket)" />
        <circle className="conv-node" cx="48" cy="48" r="10" fill="var(--accent)" />
      </svg>
    </div>
  );
}
