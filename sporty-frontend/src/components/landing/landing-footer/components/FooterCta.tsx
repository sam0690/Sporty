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
        className="font-display text-5xl font-bold tracking-tight text-foreground"
      >
        {content.title}
      </h2>

      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-foreground/65">
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
          className="h-12 w-full rounded-md border border-white/10 bg-surface px-4 text-sm text-foreground placeholder:text-foreground/40 focus:border-accent-primary/60 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 transition-all duration-200"
        />
        <Button
          type="submit"
          className="h-12 w-full rounded-md px-5 text-sm font-semibold sm:w-auto"
        >
          {content.buttonLabel}
        </Button>
      </form>

      <p className="mt-4 text-xs text-foreground/45">{content.helperText}</p>
    </div>
  );
}
