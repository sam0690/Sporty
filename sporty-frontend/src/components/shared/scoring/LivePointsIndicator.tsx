"use client";

import { memo, useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

type LivePointsIndicatorProps = {
  points: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

// Animated points counter: tweens to the new value and flashes a green/red
// delta chip when it changes (live scoring). Reduced-motion → instant update,
// no flash. Sport-agnostic.
function LivePointsIndicatorBase({ points, size = "md", className = "" }: LivePointsIndicatorProps) {
  const [display, setDisplay] = useState(points);
  const [delta, setDelta] = useState<number | null>(null);
  const prev = useRef(points);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    const to = points;
    prev.current = points;
    if (from === to) return;

    setDelta(Math.round((to - from) * 100) / 100);
    const flash = setTimeout(() => setDelta(null), 1600);

    // Respect reduced motion: jump straight to the value.
    if (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(to);
      return () => clearTimeout(flash);
    }

    const start = performance.now();
    const dur = 500;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setDisplay(Math.round((from + (to - from) * eased) * 100) / 100);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      clearTimeout(flash);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [points]);

  const textSize = size === "lg" ? "font-display text-3xl tracking-[-0.02em]"
    : size === "sm" ? "text-sm font-700" : "text-lg font-700";

  return (
    <span className={`relative inline-flex items-center gap-1 tabular-nums text-fg-1 ${textSize} ${className}`}>
      {Math.round(display)}
      {delta !== null && delta !== 0 && (
        <span
          className={`absolute -right-1 top-0 flex translate-x-full items-center gap-0.5 text-[11px] font-700 motion-reduce:hidden ${
            delta > 0 ? "text-[#34d399]" : "text-danger"
          } animate-fade-soft`}
        >
          {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {Math.abs(delta)}
        </span>
      )}
    </span>
  );
}

export const LivePointsIndicator = memo(LivePointsIndicatorBase);
