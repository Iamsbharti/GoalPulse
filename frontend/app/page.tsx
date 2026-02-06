"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { CATEGORIES } from "@/lib/constants";
import { getMoodConfig } from "@/lib/mood-constants";
import { AddResolutionModal } from "@/components/AddResolutionModal";
import { GoalSelectorModal } from "@/components/GoalSelectorModal";
import { CheckInModal } from "@/components/CheckInModal";
import GoalInsightsModal from "@/components/GoalInsightsModal";

interface Goal {
  id: string;
  title: string;
  progress: number;
  icon: string;
  category: string;
}

interface Checkin {
  id: string;
  goalTitle: string;
  goalCategory: string;
  progress: string;
  response: string;
  mood: string;
  date: string;
}

export default function Home() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<Checkin[]>([]);
  const [leastActiveGoals, setLeastActiveGoals] = useState<any[]>([]);
  const [motivationLevel, setMotivationLevel] = useState<number>(0);
  const [dailyPulseMessage, setDailyPulseMessage] = useState<string>("");

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMotivationLoading, setIsMotivationLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal State
  const [isAddResolutionOpen, setIsAddResolutionOpen] = useState(false);
  const [isGoalSelectorOpen, setIsGoalSelectorOpen] = useState(false);
  const [selectedGoalForCheckin, setSelectedGoalForCheckin] = useState<Goal | null>(null);
  const [isGoalInsightsOpen, setIsGoalInsightsOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  useEffect(() => {
    // Guard to prevent double fetch in React 18 Strict Mode
    let isMounted = true;

    const fetchGoals = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        // Fetch Goals & Recent Checkins (Fast)
        const [goalsRes, checkinsRes, leastActiveRes] = await Promise.all([
          fetch(`${apiUrl}/api/goals?userId=neo`),
          fetch(`${apiUrl}/api/checkins/recent?userId=neo`),
          fetch(`${apiUrl}/api/goals/least-active?userId=neo`)
        ]);

        if (!isMounted) return;

        const data = await goalsRes.json();
        const mappedGoals = data.goals.map((g: any) => {
          const cat = CATEGORIES.find(c => c.id === g.category) || CATEGORIES[2];
          return {
            id: g.id,
            title: g.title,
            progress: 0,
            icon: cat.icon,
            category: cat.name
          };
        });
        setGoals(mappedGoals);

        const checkinsData = await checkinsRes.json();
        setRecentCheckins(checkinsData.checkins || []);

        const leastActiveData = await leastActiveRes.json();
        setLeastActiveGoals(leastActiveData.goals || []);

        // Goals are ready, show dashboard
        setIsInitialLoading(false);

        // Fetch Motivation Insights
        setIsMotivationLoading(true);
        const insightsResponse = await fetch(`${apiUrl}/api/insights/motivation?userId=neo`);

        if (!isMounted) return;

        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json();
          setMotivationLevel(insightsData.motivation_breakdown.score);
          setDailyPulseMessage(insightsData.message);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
          setIsMotivationLoading(false);
        }
      }
    };

    fetchGoals();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} hidden lg:flex flex-col bg-white dark:bg-[#121217] border-r border-gray-100 dark:border-gray-800 transition-all duration-300 sticky top-0 h-screen`}>
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="size-10 shrink-0 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 overflow-hidden">
              <img src="/logo.png" alt="GoalPulse Logo" className="w-full h-full object-cover" />
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
                <p className="text-sm font-medium text-[#121217] dark:text-white">Neo</p>
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
            <h2 className="text-2xl font-bold text-[#121217] dark:text-white">Good morning, Neo!</h2>
            <p className="text-sm text-primary font-medium">Ready to crush your goals?</p>
          </div>
          <div className="hidden xl:flex items-center gap-2 mr-6">
            <Link href="/chat" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
              <span>Chat</span>
            </Link>
            <button
              onClick={() => setIsAddResolutionOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>New Resolution</span>
            </button>
            <Link href="/insights" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[20px]">bar_chart</span>
              <span>Stats</span>
            </Link>
          </div>
          <div className="flex items-center gap-4 border-l border-gray-100 dark:border-gray-800 pl-6">
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/5 dark:border-white/10 overflow-hidden min-h-[300px]">
                <div className="relative w-full h-48 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #F59E0B 1px, transparent 0)", backgroundSize: "24px 24px" }}></div>
                  <div className="flex flex-col items-center">
                    {isMotivationLoading ? (
                      <div className="h-16 w-32 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl animate-pulse backdrop-blur-sm mb-1"></div>
                    ) : (
                      <span className="text-amber-accent font-bold text-6xl animate-in fade-in zoom-in duration-300">{motivationLevel}%</span>
                    )}
                    <span className="text-amber-accent/80 text-sm uppercase tracking-widest font-bold mt-2">Motivation Level</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-col gap-2 mb-4">
                    <p className="text-xl font-bold text-[#121217] dark:text-white">Daily Pulse</p>
                    {isMotivationLoading ? (
                      <div className="space-y-2 animate-pulse py-1 max-w-[90%]">
                        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full"></div>
                        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-2/3"></div>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 animate-in fade-in slide-in-from-bottom-2 duration-500 leading-relaxed">
                        {dailyPulseMessage || "Calculating your vibe..."}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsGoalSelectorOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-[#4338ca] transition-all"
                  >
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>Quick Check-in</span>
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6 min-h-[200px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-[#121217] dark:text-white">Your Resolutions</h3>
                  <Link href="/goals" className="text-primary text-sm font-bold hover:underline">See all</Link>
                </div>

                {isInitialLoading && goals.length === 0 ? (
                  <div className="flex justify-center p-8">
                    <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {goals.map((goal) => (
                      <div
                        key={goal.id}
                        onClick={() => {
                          setSelectedGoalId(goal.id);
                          setIsGoalInsightsOpen(true);
                        }}
                        className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group relative"
                      >
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="material-symbols-outlined text-gray-400 text-sm">bar_chart</span>
                        </div>

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
                          <p className="font-bold text-[#121217] dark:text-white group-hover:text-primary transition-colors">{goal.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-1">{goal.category}</p>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setIsAddResolutionOpen(true)}
                      className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary hover:bg-primary/5 transition-all cursor-pointer min-h-[140px]"
                    >
                      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-2xl">add</span>
                      </div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Add New Goal</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6 min-h-[200px]">
                <h4 className="font-bold text-[#121217] dark:text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500">warning</span>
                  Needs Attention
                </h4>
                {isInitialLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl w-full"></div>
                    <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl w-full"></div>
                  </div>
                ) : leastActiveGoals.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">All goals are on track!</p>
                ) : (
                  <div className="space-y-3">
                    {leastActiveGoals.map((goal) => (
                      <div key={goal.id} className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20">
                        <div className="size-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0 text-orange-600 dark:text-orange-400">
                          <span className="material-symbols-outlined text-sm">priority_high</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#121217] dark:text-white text-sm truncate">{goal.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{goal.checkin_count} check-ins total</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedGoalForCheckin(goal);
                          }}
                          className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-white dark:bg-white/10 px-2.5 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-white/20 transition-colors"
                        >
                          Check In
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
                <h4 className="font-bold text-[#121217] dark:text-white mb-4">Recent Check-ins</h4>
                {recentCheckins.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No check-ins yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentCheckins.map((checkin) => {
                      const checkinDate = new Date(checkin.date);
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);

                      let dateDisplay = checkinDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                      if (checkinDate.toDateString() === today.toDateString()) {
                        dateDisplay = "Today";
                      } else if (checkinDate.toDateString() === yesterday.toDateString()) {
                        dateDisplay = "Yesterday";
                      }

                      const moodConfig = getMoodConfig(checkin.mood);

                      return (
                        <div key={checkin.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                          <div className={`mt-1 size-8 rounded-full flex items-center justify-center shrink-0 ${moodConfig.color}`}>
                            <span className="material-symbols-outlined text-sm">
                              {moodConfig.icon}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className="font-bold text-[#121217] dark:text-white text-sm truncate pr-2">{checkin.goalTitle}</p>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap mt-0.5">{dateDisplay}</span>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5 line-clamp-2 leading-relaxed">{checkin.response}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
          <button onClick={() => setIsAddResolutionOpen(true)} className="flex flex-col items-center gap-1 text-gray-400">
            <div className="size-6 bg-primary rounded-full flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-sm">add</span>
            </div>
            <span className="text-[10px] font-bold">Action</span>
          </button>
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
      <AddResolutionModal
        isOpen={isAddResolutionOpen}
        onClose={() => setIsAddResolutionOpen(false)}
        onGoalCreated={() => setRefreshKey(prev => prev + 1)}
      />

      <GoalSelectorModal
        isOpen={isGoalSelectorOpen}
        onClose={() => setIsGoalSelectorOpen(false)}
        goals={goals}
        onGoalSelect={(goal) => {
          setSelectedGoalForCheckin(goal);
          setIsGoalSelectorOpen(false);
        }}
      />

      {
        selectedGoalForCheckin && (
          <CheckInModal
            isOpen={true}
            onClose={() => setSelectedGoalForCheckin(null)}
            goalId={selectedGoalForCheckin.id}
            goalTitle={selectedGoalForCheckin.title}
            onCheckInComplete={() => {
              setSelectedGoalForCheckin(null);
              setRefreshKey(prev => prev + 1);
            }}
          />
        )
      }

      {selectedGoalId && (
        <GoalInsightsModal
          isOpen={isGoalInsightsOpen}
          onClose={() => setIsGoalInsightsOpen(false)}
          goalId={selectedGoalId}
        />
      )}
    </div >
  );
}
