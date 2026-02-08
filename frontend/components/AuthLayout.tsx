import Link from "next/link";

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
    linkText: string;
    linkUrl: string;
    linkAction: string;
}

export function AuthLayout({ children, title, subtitle, linkText, linkUrl, linkAction }: AuthLayoutProps) {
    return (
        <div className="min-h-screen w-full flex bg-white overflow-hidden">
            <div className="w-full lg:w-[45%] bg-white relative flex items-center justify-center p-8 sm:p-12 lg:p-16">
                <div className="w-full max-w-md space-y-8 relative z-10">
                    <div>
                        <Link href="/" className="inline-flex items-center gap-2 mb-8 group">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <img src="/logo.png" alt="GoalPulse Logo" className="w-full h-full object-cover rounded-xl" />
                            </div>
                            <span className="text-xl font-bold text-[#121217]">GoalPulse</span>
                        </Link>
                        <h1 className="text-3xl font-bold text-[#121217] mb-2">
                            {title}
                        </h1>
                        <p className="text-gray-500">{subtitle}</p>
                    </div>

                    {children}

                    <p className="text-center text-sm text-gray-500">
                        {linkText}{" "}
                        <Link href={linkUrl} className="text-primary hover:text-primary-600 font-bold hover:underline transition-all">
                            {linkAction}
                        </Link>
                    </p>
                </div>
            </div>

            <div className="hidden lg:flex w-[55%] bg-[#F9FAFB] relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-purple-500/10" />
                    <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-purple-500/15 rounded-full blur-[80px] animate-pulse animation-delay-2000" />
                    <div className="absolute top-1/2 right-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] animate-pulse animation-delay-4000" />
                </div>

                <div className="relative z-10 px-16 py-12">
                    <div className="mb-12">
                        <h2 className="text-5xl font-bold text-[#121217] leading-tight">
                            Turn Dreams <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Into Reality</span>
                        </h2>
                        <p className="text-lg text-gray-500 mt-4 max-w-md italic">
                            "Success is the sum of small efforts, repeated day in and day out."
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-green-600">check_circle</span>
                            </div>
                            <h3 className="font-semibold text-[#121217] mb-1">Smart Tracking</h3>
                            <p className="text-sm text-gray-500">AI-powered insights for your goals</p>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animation-delay-200">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-purple-600">insights</span>
                            </div>
                            <h3 className="font-semibold text-[#121217] mb-1">Beautiful Analytics</h3>
                            <p className="text-sm text-gray-500">Visualize your progress beautifully</p>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animation-delay-400">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-amber-600">local_fire_department</span>
                            </div>
                            <h3 className="font-semibold text-[#121217] mb-1">Build Streaks</h3>
                            <p className="text-sm text-gray-500">Stay consistent with gamification</p>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animation-delay-600">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-blue-600">auto_awesome</span>
                            </div>
                            <h3 className="font-semibold text-[#121217] mb-1">SmartAssist</h3>
                            <p className="text-sm text-gray-500">AI-assisted goal creation & check-in</p>
                        </div>
                    </div>
                </div>

                <svg className="absolute left-0 bottom-0 w-full h-32 text-gray-100" viewBox="0 0 1440 120" fill="currentColor">
                    <path d="M0,60 C360,120 720,0 1080,60 C1260,90 1350,60 1440,40 L1440,120 L0,120 Z" />
                </svg>
            </div>

            <style jsx>{`
                .animation-delay-200 { animation-delay: 0.2s; }
                .animation-delay-400 { animation-delay: 0.4s; }
                .animation-delay-600 { animation-delay: 0.6s; }
                .animation-delay-2000 { animation-delay: 2s; }
                .animation-delay-4000 { animation-delay: 4s; }
            `}</style>
        </div>
    );
}
