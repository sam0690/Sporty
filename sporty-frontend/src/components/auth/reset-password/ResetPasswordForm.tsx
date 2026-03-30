"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/libs/toastifier";

type ResetErrors = {
    newPassword?: string;
    confirmPassword?: string;
};

export function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { resetPassword, actionLoading } = useAuth();

    const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState<ResetErrors>({});

    const isSubmitting = actionLoading.resetPassword;

    const validate = (): boolean => {
        const nextErrors: ResetErrors = {};

        if (!newPassword.trim()) {
            nextErrors.newPassword = "New password is required.";
        } else if (newPassword.length < 6) {
            nextErrors.newPassword = "Password must be at least 6 characters.";
        }

        if (!confirmPassword.trim()) {
            nextErrors.confirmPassword = "Please confirm your password.";
        } else if (newPassword !== confirmPassword) {
            nextErrors.confirmPassword = "Passwords do not match.";
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        if (!token) {
            toastifier.error("Reset token is missing.");
            return;
        }

        if (!validate()) {
            return;
        }

        const result = await resetPassword(token, newPassword);
        if (!result.success) {
            toastifier.error(result.error ?? "Unable to reset password.");
            return;
        }

        toastifier.success("Password reset successful. Please sign in.");
        router.push("/login");
    };

    return (
        <Card className="animate-fade-in-scale animate-float mx-auto w-full max-w-md rounded-3xl border border-border-light/60 bg-surface-50/85 shadow-xl shadow-primary-500/10 backdrop-blur-xl transition-shadow hover:shadow-2xl hover:shadow-primary-500/20">
            <CardHeader className="space-y-3 text-center">
                <CardTitle className="bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                    Create New Password
                </CardTitle>
                <p className="mx-auto max-w-sm text-sm text-text-secondary">Set a fresh password to secure your account.</p>
            </CardHeader>

            <CardContent>
                {!token && (
                    <p className="mb-4 rounded-2xl border border-border-light/80 bg-gradient-to-r from-secondary-50 to-surface-100 p-3 text-sm font-medium text-text-primary">
                        Invalid or missing reset token.
                    </p>
                )}

                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="relative">
                        <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-text-primary">
                            New password
                        </label>
                        <input
                            id="newPassword"
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="Enter new password"
                            autoComplete="new-password"
                            className="h-12 w-full rounded-2xl border border-border-light/80 bg-surface-50/80 px-5 pr-14 text-sm text-text-primary placeholder:text-text-secondary transition-all duration-300 focus:-translate-y-0.5 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-4 top-[2.35rem] -translate-y-1/2 text-text-secondary transition-colors hover:text-primary-600"
                            aria-label={showPassword ? "Hide new password" : "Show new password"}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                        {errors.newPassword && <span className="mt-1 block text-xs text-accent-red">{errors.newPassword}</span>}
                    </div>

                    <div className="relative">
                        <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-text-primary">
                            Confirm password
                        </label>
                        <input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            placeholder="Confirm new password"
                            autoComplete="new-password"
                            className="h-12 w-full rounded-2xl border border-border-light/80 bg-surface-50/80 px-5 pr-14 text-sm text-text-primary placeholder:text-text-secondary transition-all duration-300 focus:-translate-y-0.5 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            className="absolute right-4 top-[2.35rem] -translate-y-1/2 text-text-secondary transition-colors hover:text-primary-600"
                            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                            {showConfirmPassword ? "Hide" : "Show"}
                        </button>
                        {errors.confirmPassword && <span className="mt-1 block text-xs text-accent-red">{errors.confirmPassword}</span>}
                    </div>

                    <Button
                        type="submit"
                        className="ripple-effect relative w-full overflow-hidden rounded-full bg-gradient-to-r from-primary-500 to-secondary-600 px-8 py-3 font-semibold tracking-wide text-text-light shadow-lg shadow-primary-500/20 transition-all hover:from-primary-600 hover:to-secondary-700"
                        disabled={isSubmitting || !token}
                    >
                        {isSubmitting ? (
                            <span className="inline-flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-light/30 border-t-text-light" />
                                Resetting...
                            </span>
                        ) : (
                            "Reset password"
                        )}
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-text-secondary">
                    <Link
                        href="/login"
                        className="group relative font-medium text-primary-600 transition-colors hover:text-primary-700"
                    >
                        Back to login
                        <span className="absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-primary-600 transition-all duration-300 group-hover:left-0 group-hover:w-full group-hover:translate-x-0" />
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
