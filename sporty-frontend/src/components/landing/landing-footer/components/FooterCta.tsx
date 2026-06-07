"use client";

import { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { FooterCtaContent } from "@/components/landing/landing-footer/types";

type FooterCtaProps = {
  content: FooterCtaContent;
};

export function FooterCta({ content }: FooterCtaProps) {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2
        id="landing-footer-title"
        className="font-barlow-condensed text-5xl font-700 tracking-[2px] text-[#f0f0f0]"
      >
        {content.title}
      </h2>

      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#f0f0f0]/65">
        {content.subtitle}
      </p>

      <form
        onSubmit={onSubmit}
        className="mx-auto mt-8 flex w-full max-w-lg flex-col items-center gap-3 sm:flex-row"
      >
        <label htmlFor="landing-footer-email" className="sr-only">
          Email address
        </label>
        <input
          id="landing-footer-email"
          type="email"
          required
          placeholder={content.inputPlaceholder}
          className="h-12 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-4 text-sm text-[#f0f0f0] placeholder:text-[#f0f0f0]/40 focus:border-[rgba(232,251,37,0.6)] focus:outline-none focus:border-[#e8fb25] transition-all duration-200"
        />
        <Button
          type="submit"
          className="h-12 w-full rounded-[3px] px-5 text-sm font-600 sm:w-auto"
        >
          {content.buttonLabel}
        </Button>
      </form>

      <p className="mt-4 text-xs text-[#f0f0f0]/45">{content.helperText}</p>
    </div>
  );
}
