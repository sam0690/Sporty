"use client";

import { useEffect, useState } from "react";

import { useMatchStore } from "@/store/matchStore";

export function ToastAlert() {
  const [visible, setVisible] = useState(false);
  const ts = useMatchStore((s) => s.lastUpdatedTs);

  useEffect(() => {
    if (!ts) {
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1200);
    return () => window.clearTimeout(timer);
  }, [ts]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-lg">
      Live update received
    </div>
  );
}
