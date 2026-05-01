"use client";

import { useState } from "react";
import { toastifier } from "@/libs/toastifier";

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
      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-black hover:bg-[#F4F4F9]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
