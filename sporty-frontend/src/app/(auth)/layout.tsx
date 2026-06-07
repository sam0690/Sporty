export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-10 text-[#f0f0f0] sm:px-6 lg:px-8">
      <div className="auth-dot-pattern pointer-events-none absolute inset-0 opacity-25" />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
