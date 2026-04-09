"use client";

import { useEffect, useState } from "react";

type UseRelativeTimeOptions = {
  refreshIntervalMs?: number;
};

export function useRelativeTime(options: UseRelativeTimeOptions = {}) {
  const { refreshIntervalMs = 60_000 } = options;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshIntervalMs]);

  return nowMs;
}
