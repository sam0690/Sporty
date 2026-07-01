export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-10 text-[#f0f0f0] sm:px-6 lg:px-8">
      {/* ambient broadcast glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 15% 10%, rgba(232,251,37,0.08), transparent 55%), radial-gradient(55% 55% at 90% 90%, rgba(0,212,255,0.07), transparent 55%)",
        }}
      />
      <div className="auth-dot-pattern pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
