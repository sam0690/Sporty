import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="relative overflow-hidden bg-[#F6F7F9] text-[#0B1220]">
      <div className="pointer-events-none absolute inset-0 opacity-40 auth-dot-pattern" />

      <section className="mx-auto flex min-h-[78vh] w-full max-w-5xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-8 text-center sm:p-12">
          <p className="font-barlow-condensed text-xs font-bold uppercase tracking-[3px] text-[#6B7280]">
            404 Error
          </p>
          <h1 className="mt-4 font-bebas text-8xl tracking-[4px] text-[#0B1220]">
            Not Found
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#6B7280]">
            The page you are looking for does not exist, has moved, or was
            removed. Let&apos;s get you back to the main pitch.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-[3px] bg-[#DC2626] px-6 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#F6F7F9] transition-colors hover:bg-[#B91C1C] hover:no-underline"
            >
              Go to Homepage
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-6 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#0B1220] transition-colors hover:border-white/15 hover:no-underline"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
