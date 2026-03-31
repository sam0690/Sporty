import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(36,123,160,0.14),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(36,123,160,0.08),_transparent_45%)]" />

      <section className="mx-auto flex min-h-[78vh] w-full max-w-5xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl rounded-3xl border border-gray-100 bg-white/90 p-8 text-center shadow-sm backdrop-blur-sm sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">404 Error</p>
          <h1 className="mt-3 text-4xl font-light tracking-tight text-gray-900 sm:text-5xl">Page Not Found</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-gray-500 sm:text-base">
            The page you are looking for does not exist, has moved, or was removed. Let&apos;s get you back to the main pitch.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full !bg-[#247BA0] px-6 text-sm font-semibold !text-white transition-colors hover:!bg-[#1d6280]"
            >
              Go to Homepage
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-full border border-gray-300 !bg-white px-6 text-sm font-semibold !text-gray-700 transition-colors hover:!bg-gray-50"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
