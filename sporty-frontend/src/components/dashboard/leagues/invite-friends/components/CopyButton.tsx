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
      className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1.5 text-xs text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
