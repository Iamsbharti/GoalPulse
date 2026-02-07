"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

import { AuthLayout } from "@/components/AuthLayout";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { login, loginAsDefault, isLoading } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.message || "Login failed");
        }
    };

    const handleDefaultLogin = async () => {
        setError("");
        try {
            await loginAsDefault();
        } catch (err: any) {
            setError(err.message || "Login failed");
        }
    };

    return (
        <AuthLayout
            title="Welcome Back"
            subtitle="Sign in to continue your journey"
            linkText="Don't have an account?"
            linkUrl="/signup"
            linkAction="Sign up"
        >
            {error && (
                <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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

                <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                        <span className="text-gray-500 dark:text-gray-400">Remember me</span>
                    </label>
                    <a href="#" className="text-primary hover:text-primary-600 font-medium">Forgot password?</a>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-primary-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : "Sign In"}
                </button>
            </form>

            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-[#121217] text-gray-400 uppercase tracking-widest text-xs font-bold">Or</span>
                </div>
            </div>

            <button
                onClick={handleDefaultLogin}
                disabled={isLoading}
                className="w-full bg-white dark:bg-[#1a1a2e] hover:bg-gray-50 dark:hover:bg-[#23233e] text-gray-700 dark:text-gray-300 font-medium py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 transition-all flex items-center justify-center gap-3 group"
            >
                <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">account_circle</span>
                <span>Login as Default User (Neo)</span>
            </button>
        </AuthLayout>
    );
}
