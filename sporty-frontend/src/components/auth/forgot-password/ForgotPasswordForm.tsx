"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
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
        <Card className="animate-fade-in-scale animate-float mx-auto w-full max-w-md rounded-3xl border border-border-light/60 bg-surface-50/85 shadow-xl shadow-primary-500/10 backdrop-blur-xl transition-shadow hover:shadow-2xl hover:shadow-primary-500/20">
            <CardHeader className="space-y-3 text-center">
                <CardTitle className="bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                    Reset Password
                </CardTitle>
                <p className="mx-auto max-w-sm text-sm text-text-secondary">Enter your email and we will send secure reset instructions.</p>
            </CardHeader>

            <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-primary">
                            Email
                        </label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="name@example.com"
                            autoComplete="email"
                            error={emailError}
                            className="rounded-2xl border-border-light/80 bg-surface-50/80 px-5 py-3.5 text-text-primary placeholder:text-text-secondary transition-all duration-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="ripple-effect relative w-full overflow-hidden rounded-full bg-gradient-to-r from-primary-500 to-secondary-600 px-8 py-3 font-semibold tracking-wide text-text-light shadow-lg shadow-primary-500/20 transition-all hover:from-primary-600 hover:to-secondary-700"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="inline-flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-light/30 border-t-text-light" />
                                Sending...
                            </span>
                        ) : (
                            "Send reset link"
                        )}
                    </Button>
                </form>

                {isSubmitted && (
                    <p className="mt-4 rounded-2xl border border-secondary-300/70 bg-gradient-to-r from-secondary-50 to-secondary-100 p-3 text-sm font-medium text-primary-700">
                        If an account exists with that email, you&apos;ll receive a reset link.
                    </p>
                )}

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
