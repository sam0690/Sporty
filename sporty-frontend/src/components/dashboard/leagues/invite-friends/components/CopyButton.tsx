"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
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
    toastifier.success(`${label} copied`);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm px-3.5 py-1.5 font-condensed text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
        copied
          ? "bg-primary text-on-primary"
          : "border border-primary/35 text-primary hover:bg-primary-soft"
      }`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Copy
        </>
      )}
    </button>
  );
}
