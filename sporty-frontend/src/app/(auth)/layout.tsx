export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-ink sm:px-6 lg:px-8">
      {/* ambient broadcast wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 15% 10%, rgba(220,38,38,0.06), transparent 55%), radial-gradient(55% 55% at 90% 90%, rgba(37,99,235,0.05), transparent 55%)",
        }}
      />
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
