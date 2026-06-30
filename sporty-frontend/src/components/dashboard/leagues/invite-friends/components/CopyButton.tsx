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
      className={`shrink-0 rounded-[3px] px-3.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] transition-colors ${
        copied
          ? "bg-[#e8fb25] text-[#0a0a0f]"
          : "border border-[rgba(232,251,37,0.35)] text-[#e8fb25] hover:bg-[rgba(232,251,37,0.1)]"
      }`}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}
