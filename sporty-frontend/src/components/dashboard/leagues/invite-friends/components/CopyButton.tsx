"use client";

import { useState } from "react";
import { toastifier } from "@/lib/toastifier";

type CopyButtonProps = {
  value: string;
  label: string;
};

export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toastifier.success(`✓ ${label} copied`);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`shrink-0 rounded-[3px] px-3.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1.5px] transition-colors ${
        copied
          ? "bg-accent text-surface-0"
          : "border border-accent/35 text-accent hover:bg-accent/10"
      }`}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}
