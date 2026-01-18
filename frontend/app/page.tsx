"use client";

import Link from "next/link";
import { useState } from "react";

interface Goal {
  id: string;
  title: string;
  progress: number;
  icon: string;
  category: string;
}

export default function Home() {
  const [goals] = useState<Goal[]>([
    { id: "1", title: "Morning Run", progress: 60, icon: "directions_run", category: "60% of goal" },
    { id: "2", title: "Save $500/mo", progress: 64, icon: "savings", category: "$320 saved" },
    { id: "3", title: "Read 20 books", progress: 20, icon: "menu_book", category: "4/20 books" },
  ]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} hidden lg:flex flex-col bg-white dark:bg-[#121217] border-r border-gray-100 dark:border-gray-800 transition-all duration-300 sticky top-0 h-screen`}>
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="size-10 shrink-0 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary text-2xl">smart_toy</span>
            </div>
            {isSidebarOpen && <h1 className="text-xl font-bold text-[#121217] dark:text-white">GoalPulse</h1>}
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            {isSidebarOpen && <span className="font-medium">Dashboard</span>}
          </Link>
          <Link href="/chat" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">forum</span>
            {isSidebarOpen && <span className="font-medium">Pulse AI</span>}
          </Link>
          <Link href="/goals" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">track_changes</span>
            {isSidebarOpen && <span className="font-medium">Goals</span>}
          </Link>
          <Link href="/insights" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">analytics</span>
            {isSidebarOpen && <span className="font-medium">Insights</span>}
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-gray-500">person</span>
            </div>
            {isSidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-medium text-[#121217] dark:text-white">Alex</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pro Member</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-h-screen">
        <header className="hidden lg:flex items-center bg-background-light dark:bg-background-dark px-8 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-4">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[#121217] dark:text-white">Good morning, Alex!</h2>
            <p className="text-sm text-primary font-medium">Ready to crush your goals?</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/5 dark:border-white/10 overflow-hidden">
                <div className="relative w-full h-48 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #F59E0B 1px, transparent 0)", backgroundSize: "24px 24px" }}></div>
                  <div className="flex flex-col items-center">
                    <span className="text-amber-accent font-bold text-6xl">85%</span>
                    <span className="text-amber-accent/80 text-sm uppercase tracking-widest font-bold mt-2">Motivation Level</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-col gap-2 mb-4">
                    <p className="text-xl font-bold text-[#121217] dark:text-white">Daily Pulse</p>
                    <p className="text-gray-500 dark:text-gray-400">Your energy is high today. You&apos;ve stayed consistent for <span className="text-primary font-bold">5 days</span> straight!</p>
                  </div>
                  <Link href="/chat" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-[#4338ca] transition-all">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>Quick Check-in</span>
                  </Link>
                </div>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-[#121217] dark:text-white">Your Resolutions</h3>
                  <Link href="/goals" className="text-primary text-sm font-bold hover:underline">See all</Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {goals.map((goal) => (
                    <div key={goal.id} className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="relative size-20 mx-auto">
                        <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                          <circle className="stroke-gray-200 dark:stroke-gray-700" cx="18" cy="18" fill="none" r="16" strokeWidth="3"></circle>
                          <circle 
                            className="stroke-primary" 
                            cx="18" 
                            cy="18" 
                            fill="none" 
                            r="16" 
                            strokeDasharray="100" 
                            strokeDashoffset={100 - goal.progress} 
                            strokeLinecap="round" 
                            strokeWidth="3"
                          ></circle>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary text-2xl">{goal.icon}</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-[#121217] dark:text-white">{goal.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-1">{goal.category}</p>
                      </div>
                    </div>
                  ))}
                  <Link href="/goals" className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary hover:bg-primary/5 transition-all cursor-pointer min-h-[140px]">
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-2xl">add</span>
                    </div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Add New Goal</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-2xl border border-emerald-accent/20 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-emerald-accent text-xl">insights</span>
                  <p className="text-emerald-accent text-sm font-bold uppercase tracking-widest">AI Insights</p>
                </div>
                <p className="text-[#121217] dark:text-white text-base leading-relaxed mb-4">
                  Based on your morning patterns, you&apos;re <span className="font-bold text-emerald-accent">85% likely</span> to hit your &apos;Morning Run&apos; goal this week.
                </p>
                <Link href="/insights" className="text-sm font-bold text-primary flex items-center gap-1 hover:gap-2 transition-all">
                  View Detail Report
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
                <h4 className="font-bold text-[#121217] dark:text-white mb-4">Quick Actions</h4>
                <div className="space-y-3">
                  <Link href="/chat" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">chat_bubble</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#121217] dark:text-white">Start Chat</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Talk to your AI coach</p>
                    </div>
                  </Link>
                  <Link href="/goals" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="size-10 rounded-full bg-amber-accent/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-amber-accent">add_circle</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#121217] dark:text-white">New Resolution</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Set a new goal</p>
                    </div>
                  </Link>
                  <Link href="/insights" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="size-10 rounded-full bg-emerald-accent/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-accent">bar_chart</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#121217] dark:text-white">View Stats</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Check your progress</p>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
                <h4 className="font-bold text-[#121217] dark:text-white mb-4">Upcoming Check-ins</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                    <span className="material-symbols-outlined text-amber-accent">schedule</span>
                    <div className="flex-1">
                      <p className="font-medium text-[#121217] dark:text-white text-sm">Morning Run</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tomorrow, 6:00 AM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <span className="material-symbols-outlined text-primary">event</span>
                    <div className="flex-1">
                      <p className="font-medium text-[#121217] dark:text-white text-sm">Meditation</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">In 2 days</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-background-dark/90 backdrop-blur-xl border-t border-black/5 dark:border-white/10 px-6 py-3 pb-8 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <Link href="/" className="flex flex-col items-center gap-1 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            <span className="text-[10px] font-bold">Home</span>
          </Link>
          <Link href="/chat" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="material-symbols-outlined">forum</span>
            <span className="text-[10px] font-bold">Pulse AI</span>
          </Link>
          <Link href="/goals" className="flex flex-col items-center gap-1 text-gray-400">
            <div className="size-6 bg-primary rounded-full flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-sm">add</span>
            </div>
            <span className="text-[10px] font-bold">Action</span>
          </Link>
          <Link href="/insights" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="material-symbols-outlined">analytics</span>
            <span className="text-[10px] font-bold">Stats</span>
          </Link>
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-bold">Profile</span>
          </div>
        </div>
      </nav>
    </div>
  );
}
