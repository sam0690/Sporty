export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="auth-dot-pattern pointer-events-none absolute inset-0 opacity-25" />
      <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-accent-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-accent-secondary/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/4 h-64 w-64 rounded-full bg-accent-tertiary/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-accent-primary/10 to-transparent" />

      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
