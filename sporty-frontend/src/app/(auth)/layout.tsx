export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="auth-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F4F9]">
            <div className="auth-dot-pattern pointer-events-none absolute inset-0 opacity-30" />
            <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 animate-pulse rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 animate-pulse rounded-full bg-secondary/20 blur-3xl" />
            <div className="pointer-events-none absolute left-1/3 top-1/4 h-64 w-64 animate-pulse rounded-full bg-accent/25 blur-3xl" />

            <div className="relative z-10 w-full">{children}</div>
        </div>
    );
}
