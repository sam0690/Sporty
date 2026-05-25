import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(255,61,129,0.08),transparent_45%)]" />

      <section className="mx-auto flex min-h-[78vh] w-full max-w-5xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-surface/90 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">
            404 Error
          </p>
          <h1 className="mt-3 text-4xl font-light tracking-tight text-foreground sm:text-5xl">
            Page Not Found
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-foreground/65 sm:text-base">
            The page you are looking for does not exist, has moved, or was
            removed. Let&apos;s get you back to the main pitch.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full bg-accent-primary! px-6 text-sm font-semibold text-black! transition-colors hover:bg-accent-secondary!"
            >
              Go to Homepage
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5! px-6 text-sm font-semibold text-foreground! transition-colors hover:bg-white/10!"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
