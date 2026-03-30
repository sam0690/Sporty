"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/libs/toastifier";

type SignUpErrors = {
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpForm() {
    const router = useRouter();
    const { register, actionLoading } = useAuth();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState<SignUpErrors>({});

    const isSubmitting = actionLoading.register;

    const passwordStrength = (() => {
        if (!password) {
            return { label: "", width: "0%", color: "bg-border-light", icon: "" };
        }
        const hasLetters = /[a-zA-Z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecial = /[^a-zA-Z\d]/.test(password);
        if (password.length >= 10 && hasLetters && hasNumbers && hasSpecial) {
            return { label: "Strong", width: "100%", color: "bg-pitch-green", icon: "✓" };
        }
        if (password.length >= 6 && hasLetters && hasNumbers) {
            return { label: "Medium", width: "66%", color: "bg-accent-yellow", icon: "!" };
        }
        return { label: "Weak", width: "33%", color: "bg-accent-red", icon: "✕" };
    })();

    const validate = (): boolean => {
        const nextErrors: SignUpErrors = {};

        if (!name.trim()) {
            nextErrors.name = "Name is required.";
        }

        if (!email.trim()) {
            nextErrors.email = "Email is required.";
        } else if (!emailRegex.test(email)) {
            nextErrors.email = "Please enter a valid email address.";
        }

        if (!password.trim()) {
            nextErrors.password = "Password is required.";
        } else if (password.length < 6) {
            nextErrors.password = "Password must be at least 6 characters.";
        }

        if (!confirmPassword.trim()) {
            nextErrors.confirmPassword = "Please confirm your password.";
        } else if (password !== confirmPassword) {
            nextErrors.confirmPassword = "Passwords do not match.";
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        if (!validate()) {
            return;
        }

        const result = await register(name, email, password);
        if (!result.success) {
            toastifier.error(result.error ?? "Unable to create account.");
            return;
        }

        toastifier.success("Account created! Please sign in");
        router.push("/login");
    };

    return (
        <Card className="animate-fade-in-scale animate-float mx-auto w-full max-w-md rounded-3xl border border-border-light/60 bg-surface-50/85 shadow-xl shadow-primary-500/10 backdrop-blur-xl transition-shadow hover:shadow-2xl hover:shadow-primary-500/20">
            <CardHeader className="space-y-3 text-center">
                <CardTitle className="bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                    Create Account
                </CardTitle>
                <p className="mx-auto max-w-sm text-sm text-text-secondary">Join Sporty and start building your multi-sport fantasy empire.</p>
            </CardHeader>

            <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="mb-1 block text-sm font-medium text-text-primary">
                            Name
                        </label>
                        <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Your name"
                            autoComplete="name"
                            error={errors.name}
                            className="rounded-2xl border-border-light/80 bg-surface-50/80 px-5 py-3.5 text-text-primary placeholder:text-text-secondary transition-all duration-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20"
                        />
                    </div>

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
                            error={errors.email}
                            className="rounded-2xl border-border-light/80 bg-surface-50/80 px-5 py-3.5 text-text-primary placeholder:text-text-secondary transition-all duration-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20"
                        />
                    </div>

                    <div className="relative">
                        <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-primary">
                            Password
                        </label>
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Create a password"
                            autoComplete="new-password"
                            className="h-12 w-full rounded-2xl border border-border-light/80 bg-surface-50/80 px-5 pr-14 text-sm text-text-primary placeholder:text-text-secondary transition-all duration-300 focus:-translate-y-0.5 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-4 top-[2.35rem] -translate-y-1/2 text-text-secondary transition-colors hover:text-primary-600"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                        {errors.password && <span className="mt-1 block text-xs text-accent-red">{errors.password}</span>}

                        {password && (
                            <div className="mt-2 space-y-1">
                                <div className="h-2 w-full overflow-hidden rounded-full bg-border-light">
                                    <div
                                        className={`h-full rounded-full ${passwordStrength.color} transition-all duration-300`}
                                        style={{ width: passwordStrength.width }}
                                    />
                                </div>
                                <p className="text-xs font-medium text-text-secondary">
                                    {passwordStrength.icon} Password strength: {passwordStrength.label}
                                </p>
                            </div>
                        )}
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
                            placeholder="Confirm your password"
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
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="inline-flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-light/30 border-t-text-light" />
                                Creating account...
                            </span>
                        ) : (
                            "Create account"
                        )}
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-text-secondary">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="group relative font-medium text-primary-600 transition-colors hover:text-primary-700"
                    >
                        Sign in
                        <span className="absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-primary-600 transition-all duration-300 group-hover:left-0 group-hover:w-full group-hover:translate-x-0" />
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
