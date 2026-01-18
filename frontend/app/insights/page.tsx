"use client";

import Link from "next/link";

export default function InsightsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-[#121217] dark:text-white flex">
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
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">home</span>
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
          <Link href="/insights" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
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
        <header className="hidden lg:flex items-center bg-white dark:bg-[#121217] px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-4">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[#121217] dark:text-white">Insights</h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <span className="material-symbols-outlined">calendar_today</span>
              <span className="text-sm font-medium">This Week</span>
            </button>
            <button className="p-2 text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-8 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6 lg:hidden">
            <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
              <span className="material-symbols-outlined">arrow_back</span>
              <span>Back</span>
            </Link>
            <h2 className="text-xl font-bold text-[#121217] dark:text-white">Insights</h2>
            <div className="w-16"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Consistency Score</p>
                    <h3 className="text-4xl font-bold tracking-tight mt-1">84%</h3>
                  </div>
                  <div className="bg-emerald-accent/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-accent text-lg">trending_up</span>
                    <span className="text-emerald-accent text-sm font-bold">+12%</span>
                  </div>
                </div>
                <div className="h-56 w-full mt-4">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 400 150">
                    <defs>
                      <linearGradient id="chartGradient2" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#5a4edf" stopOpacity="0.3"></stop>
                        <stop offset="100%" stopColor="#5a4edf" stopOpacity="0"></stop>
                      </linearGradient>
                    </defs>
                    <line className="text-gray-100 dark:text-gray-700" stroke="currentColor" strokeWidth="1" x1="0" x2="400" y1="0" y2="0"></line>
                    <line className="text-gray-100 dark:text-gray-700" stroke="currentColor" strokeWidth="1" x1="0" x2="400" y1="50" y2="50"></line>
                    <line className="text-gray-100 dark:text-gray-700" stroke="currentColor" strokeWidth="1" x1="0" x2="400" y1="100" y2="100"></line>
                    <path d="M0 120 Q 50 110, 80 80 T 150 60 T 220 90 T 300 40 T 400 30 V 150 H 0 Z" fill="url(#chartGradient2)"></path>
                    <path d="M0 120 Q 50 110, 80 80 T 150 60 T 220 90 T 300 40 T 400 30" fill="none" stroke="#5a4edf" strokeLinecap="round" strokeWidth="3"></path>
                    <circle cx="300" cy="40" fill="#5a4edf" r="5"></circle>
                    <circle cx="400" cy="30" fill="#5a4edf" r="5"></circle>
                  </svg>
                </div>
                <div className="flex justify-between mt-4 px-2">
                  <p className="text-xs font-bold text-gray-400">MON</p>
                  <p className="text-xs font-bold text-gray-400">TUE</p>
                  <p className="text-xs font-bold text-gray-400">WED</p>
                  <p className="text-xs font-bold text-gray-400">THU</p>
                  <p className="text-xs font-bold text-gray-400">FRI</p>
                  <p className="text-xs font-bold text-gray-400">SAT</p>
                  <p className="text-xs font-bold text-primary">SUN</p>
                </div>
              </div>

              <div className="bg-amber-accent/5 dark:bg-amber-accent/10 border-2 border-amber-accent/20 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10">
                  <span className="material-symbols-outlined text-9xl text-amber-accent">warning</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-amber-accent text-xl">smart_toy</span>
                  <p className="text-amber-accent text-sm font-bold uppercase tracking-tight">AI Accountability Nudge</p>
                </div>
                <h4 className="text-xl font-bold leading-tight mb-3">Attention Required</h4>
                <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed mb-4 max-w-xl">
                  Your evening routine consistency has dipped by 15% this week. Remember your <span className="font-bold">&apos;Daily Meditation&apos;</span> resolution. You&apos;ve got this!
                </p>
                <Link href="/chat" className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-accent text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-accent/25">
                  Take Action Now
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xl font-bold">Weekly Insights</h4>
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <span className="material-symbols-outlined">more_horiz</span>
                  </button>
                </div>
                <div className="flex gap-6">
                  <div className="size-32 rounded-2xl shrink-0 overflow-hidden bg-gray-100">
                    <img className="w-full h-full object-cover" alt="Person practicing peaceful yoga at sunrise" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxptzIFF9xRk7cXnOlpKXvoEKo85105VR9ECG-_zVg-W5SpsrWyCfM7ONtgUdiv3ni4zLcbKvgxvMLUbnEsWF32xVbKgE3Nhmyx-OfsRxcgv_YF6IUSUHkj1fyrzi_Lkhm8_e_ff4Hq5pddl7kusMdgom2PWWs6oPwrwpraT9mJG1Hl4YnGOBP98qaCYhNOu8y0NJ0MW7QNWq1C23nPXBXyQEl1aQgoCTOcUVrYYipwFigbLKsUGyLkToEexsvhKs2Y3bFuJWhLQ" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-lg font-medium leading-relaxed">
                      &quot;Mornings remain your strongest time. You complete 95% of tasks before 9 AM.&quot;
                    </p>
                    <button className="text-sm text-primary font-bold mt-3 flex items-center gap-1 hover:gap-2 transition-all w-fit">
                      View full summary
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 bg-white dark:bg-white/5 rounded-2xl p-5 shadow-sm border border-black/5 dark:border-white/10">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Complete</p>
                  <div className="flex items-end gap-2 mt-2">
                    <p className="text-3xl font-bold text-emerald-accent">92%</p>
                    <span className="text-sm text-emerald-accent font-bold mb-1">↑ 5%</span>
                  </div>
                </div>
                <div className="flex-1 bg-white dark:bg-white/5 rounded-2xl p-5 shadow-sm border border-black/5 dark:border-white/10">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Check-ins</p>
                  <div className="flex items-end gap-2 mt-2">
                    <p className="text-3xl font-bold">48</p>
                    <span className="text-sm text-emerald-accent font-bold mb-1">↑ 8%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
                <h4 className="text-lg font-bold mb-4">Streaks &amp; Achievements</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="size-14 rounded-full bg-emerald-accent/10 border-2 border-emerald-accent flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-accent text-2xl">local_fire_department</span>
                    </div>
                    <p className="text-xs font-bold text-center">12 Day Streak</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="size-14 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-2xl">workspace_premium</span>
                    </div>
                    <p className="text-xs font-bold text-center">Early Bird</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl opacity-50">
                    <div className="size-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-400">
                      <span className="material-symbols-outlined text-gray-500 text-2xl">lock</span>
                    </div>
                    <p className="text-xs font-bold text-center">Unlocked</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="size-14 rounded-full bg-emerald-accent/10 border-2 border-emerald-accent flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-accent text-2xl">eco</span>
                    </div>
                    <p className="text-xs font-bold text-center">Habit Builder</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary/10 to-indigo-100 dark:from-primary/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary text-xl">tips_and_updates</span>
                  <p className="text-primary text-sm font-bold uppercase tracking-widest">Pro Tip</p>
                </div>
                <p className="text-sm leading-relaxed">
                  Your best performance days are <span className="font-bold">Mondays and Tuesdays</span>. Consider scheduling challenging goals on these days.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-background-dark/90 backdrop-blur-xl border-t border-black/5 dark:border-white/10 px-6 py-3 pb-8 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <Link href="/" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="material-symbols-outlined">home</span>
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
          <Link href="/insights" className="flex flex-col items-center gap-1 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
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

import { useState } from "react";
