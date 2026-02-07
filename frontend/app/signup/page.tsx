"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

import { AuthLayout } from "@/components/AuthLayout";

export default function SignupPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { signup, isLoading } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            await signup(name, email, password);
        } catch (err: any) {
            setError(err.message || "Signup failed");
        }
    };

    return (
        <AuthLayout
            title="Join GoalPulse"
            subtitle="Start your journey to better habits"
            linkText="Already have an account?"
            linkUrl="/login"
            linkAction="Sign in"
        >
            {error && (
                <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        placeholder="John Doe"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        placeholder="you@example.com"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        placeholder="••••••••"
                    />
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : "Create Account"}
                    </button>
                    <p className="text-xs text-center text-gray-400 mt-4">
                        By signing up, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </form>
        </AuthLayout>
    );
}
