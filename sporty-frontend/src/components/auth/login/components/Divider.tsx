export function Divider() {
    return (
        <div className="my-6 flex items-center gap-4 text-xs font-medium uppercase tracking-[0.12em] text-text-secondary">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border-light to-transparent" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border-light to-transparent" />
        </div>
    );
}
