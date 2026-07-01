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
        className="font-condensed text-5xl font-bold uppercase tracking-[0.01em] text-ink"
      >
        {content.title}
      </h2>

      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-ink-muted">
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
          className="h-12 w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-4 text-sm text-ink placeholder:text-ink-faint transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button
          type="submit"
          className="h-12 w-full px-5 text-sm sm:w-auto"
        >
          {content.buttonLabel}
        </Button>
      </form>

      <p className="mt-4 text-xs text-ink-muted">{content.helperText}</p>
    </div>
  );
}
