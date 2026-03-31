"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { AuthHeroImage } from "@/components/auth/shared/AuthHeroImage";
import { AuthPageShell } from "@/components/auth/shared/AuthPageShell";
import { useAuth } from "@/context/auth-context";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
    const { forgotPassword, actionLoading } = useAuth();

    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);

    const isSubmitting = actionLoading.forgotPassword;

    const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        if (!email.trim()) {
            setEmailError("Email is required.");
            return;
        }

        if (!emailRegex.test(email)) {
            setEmailError("Please enter a valid email address.");
            return;
        }

        setEmailError("");

        await forgotPassword(email);

        setIsSubmitted(true);
    };

    return (
        <AuthPageShell
            hero={
                <AuthHeroImage
                    title="Remember your password?"
                    subtitle="Head back to login and continue managing your fantasy teams."
                    bullets={["Quick account access", "Secure sign-in experience"]}
                />
            }
        >
            <Card className="animate-fade-in mx-auto w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-2xl">
                <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
                    <div className="flex items-center gap-2 text-primary-800">
                        <span className="text-lg" aria-hidden="true">⚽🏀🏏</span>
                        <span className="text-base font-semibold">Sporty</span>
                    </div>
                    <CardTitle className="text-3xl font-bold text-primary-800 sm:text-4xl">Forgot password?</CardTitle>
                    <p className="text-sm text-text-secondary">No worries, we&apos;ll send you reset instructions</p>
                </CardHeader>

                <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-primary">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="name@example.com"
                                    autoComplete="email"
                                    error={emailError}
                                    className="h-12 rounded-xl border border-gray-300 bg-white px-4 pl-10 text-base text-text-primary placeholder:text-gray-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="h-12 w-full rounded-xl border border-[#1e6785] !bg-[#247BA0] px-6 text-base font-semibold !text-white shadow-md transition-all duration-200 hover:!bg-[#1e6785] hover:shadow-lg active:scale-[0.98] disabled:!bg-[#247BA0]/70 disabled:!text-white"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Sending...
                                </span>
                            ) : (
                                "Send Reset Link"
                            )}
                        </Button>
                    </form>

                    {isSubmitted && (
                        <p className="rounded-xl border border-secondary-300/70 bg-secondary-50 p-3 text-sm font-medium text-primary-700">
                            If an account exists with that email, you&apos;ll receive a reset link
                        </p>
                    )}

                    <div className="flex justify-center">
                        <Link href="/login" className="rounded-xl border-2 border-primary-600 bg-white px-4 py-2 text-sm font-semibold text-primary-600 transition-colors hover:bg-primary-50">
                            Back to Login
                        </Link>
                    </div>

                    <p className="border-t border-gray-200 pt-4 text-center text-sm text-text-secondary">
                        <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
                            Back to Login
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </AuthPageShell>
    );
}
