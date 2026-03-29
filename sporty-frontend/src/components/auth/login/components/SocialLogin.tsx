import { Button } from "@/components/ui";

export function SocialLogin() {
    return (
        <div className="grid grid-cols-2 gap-3">
            <Button
                type="button"
                variant="outline"
                className="rounded-full border border-border-light/80 bg-surface-50/80 px-4 py-3 text-text-primary backdrop-blur-sm transition-colors hover:bg-secondary-50"
            >
                <span className="mr-2 text-sm">G</span>
                Google
            </Button>
            <Button
                type="button"
                variant="outline"
                className="rounded-full border border-border-light/80 bg-surface-50/80 px-4 py-3 text-text-primary backdrop-blur-sm transition-colors hover:bg-secondary-50"
            >
                <span className="mr-2 text-sm">GH</span>
                GitHub
            </Button>
        </div>
    );
}
