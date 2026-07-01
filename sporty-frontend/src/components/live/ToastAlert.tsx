"use client";

import { useEffect, useState } from "react";

import { useMatchStore } from "@/store/matchStore";

export function ToastAlert() {
  const ts = useMatchStore((s) => s.lastUpdatedTs);
  const [shownTs, setShownTs] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  // Show on a new update. Adjusting state during render on a changed key is
  // React's recommended alternative to calling setState inside an effect.
  if (ts && ts !== shownTs) {
    setShownTs(ts);
    setVisible(true);
  }

  // Auto-hide after a moment — a timer is a legit effect (external system), and
  // the setState lives in the callback, not the effect body.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), 1200);
    return () => window.clearTimeout(timer);
  }, [visible, shownTs]);

  if (!visible) {
    return null;
  }

  return (
    <div className="animate-fade-in-scale fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-[rgba(232,251,37,0.32)] bg-[rgba(20,20,27,0.85)] px-3.5 py-2 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#e8fb25] shadow-[0_12px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(232,251,37,0.08)] backdrop-blur-xl">
      <span className="size-1.5 rounded-full bg-[#e8fb25] animate-live-pulse" />
      Live update
    </div>
  );
}
