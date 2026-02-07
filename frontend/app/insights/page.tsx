"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

import {
  MotivationBreakdownCard,
  MotivationTrendSparkline,
  AIQualityPanel,
  AtRiskCard,
  DailyPulseCard,
  InsightsData,
  InsightsRightPanel
} from "@/components/InsightsComponents";


export default function InsightsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetched = useRef(false);

  // In production, this would come from auth context
  const userId = "neo";

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchInsights = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/insights/motivation?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setInsights(data);
        }
      } catch (error) {
        console.error("Error fetching insights:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
  }, []);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-[#121217] dark:text-white flex">
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
                <p className="text-sm font-medium text-[#121217] dark:text-white">Neo</p>
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

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 animate-pulse">Analyzing motivation insights...</p>
            </div>
          ) : insights ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Daily Pulse - Primary Narrative */}
                <DailyPulseCard
                  microLabel={insights.micro_label}
                  motivationLabel={insights.motivation_label}
                  message={insights.message}
                />

                {/* At-Risk Card (conditional) */}
                <AtRiskCard
                  atRisk={insights.at_risk}
                  explanation={insights.alert_explanation}
                  goalId={insights.goal_id}
                />

                {/* Motivation Breakdown */}
                <MotivationBreakdownCard breakdown={insights.motivation_breakdown} />

                {/* Motivation Trend */}
                <MotivationTrendSparkline history={insights.motivation_history} />
              </div>

              <InsightsRightPanel insights={insights} goalId={insights.goal_id}/>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-500">Unable to load insights. Please try again.</p>
            </div>
          )}
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
