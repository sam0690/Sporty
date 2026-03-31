export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="auth-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-surface-100 via-surface-50 to-surface-100">
            <div className="auth-dot-pattern pointer-events-none absolute inset-0 opacity-40" />
            <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 animate-pulse rounded-full bg-primary-200/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 animate-pulse rounded-full bg-secondary-300/30 blur-3xl" />
            <div className="pointer-events-none absolute left-1/3 top-1/4 h-64 w-64 animate-pulse rounded-full bg-accent-basketball/30 blur-3xl" />

            <div className="relative z-10 w-full">{children}</div>
        </div>
    );
}
