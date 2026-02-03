"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// ----- Reusable Component Types -----
interface MotivationBreakdown {
  score: number;
  consistency: number;
  vibe: number;
}

interface MotivationHistoryPoint {
  date: string;
  score: number;
  consistency: number | null;
  vibe: number | null;
}

interface MessageQuality {
  encouragement: number;
  alignment: number;
  clarity: number;
  average: number;
}

interface AtRiskData {
  level: string;
  confidence: number;
  reasons: string[];
}

interface InsightsData {
  micro_label: string;
  motivation_label: string;
  message: string;
  show_alert: boolean;
  alert_explanation: string | null;
  motivation_breakdown: MotivationBreakdown;
  motivation_history: MotivationHistoryPoint[];
  message_quality: MessageQuality;
  at_risk: AtRiskData;
}

// ----- Reusable Components (for future goal-based insights) -----

function MotivationBreakdownCard({ breakdown }: { breakdown: MotivationBreakdown }) {
  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
      <div className="flex justify-between items-start mb-5">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">How Your Score is Calculated</p>
          <h3 className="text-4xl font-bold tracking-tight mt-1">{breakdown.score}%</h3>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
          <span className="material-symbols-outlined text-primary text-lg">psychology</span>
          <span className="text-primary text-sm font-bold">Breakdown</span>
        </div>
      </div>

      {/* Consistency Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Consistency</span>
          <span className="text-sm font-bold text-emerald-500">{breakdown.consistency}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${breakdown.consistency}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">How regularly you check in (60% weight)</p>
      </div>

      {/* Vibe Bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Vibe</span>
          <span className="text-sm font-bold text-amber-500">{breakdown.vibe}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${breakdown.vibe}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Your mood × progress combo (40% weight)</p>
      </div>
    </div>
  );
}

function MotivationTrendSparkline({ history }: { history: MotivationHistoryPoint[] }) {
  const [activeTab, setActiveTab] = useState<'score' | 'consistency' | 'vibe'>('score');

  // Show empty state if no history
  if (history.length === 0) {
    return (
      <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
        <h4 className="text-lg font-bold mb-2">Trend Analysis</h4>
        <p className="text-gray-500 text-sm">Not enough data yet. Keep checking in to see your trends!</p>
      </div>
    );
  }

  const dataPoints = history.slice(-7);

  // Tab configuration
  const tabs = {
    score: { label: 'Score', color: '#5a4edf', gradientId: 'scoreGradient' },
    consistency: { label: 'Consistency', color: '#10b981', gradientId: 'consistencyGradient' },
    vibe: { label: 'Vibe', color: '#f59e0b', gradientId: 'vibeGradient' }
  };

  // Get values based on active tab
  const getValueForTab = (point: MotivationHistoryPoint) => {
    if (activeTab === 'consistency') return point.consistency || 0;
    if (activeTab === 'vibe') return point.vibe || 0;
    return point.score;
  };

  // SVG dimensions
  const width = 400;
  const height = 150;
  const padding = { top: 10, bottom: 30, left: 10, right: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate min/max for scaling
  const values = dataPoints.map(getValueForTab);
  const minValue = Math.min(...values) - 10;
  const maxValue = Math.max(...values) + 10;
  const valueRange = maxValue - minValue;

  // Calculate change percentage
  const firstValue = getValueForTab(dataPoints[0]) || 0;
  const lastValue = getValueForTab(dataPoints[dataPoints.length - 1]) || 0;
  const changePercent = firstValue > 0 ? Math.round(((lastValue - firstValue) / firstValue) * 100) : 0;
  const isPositive = changePercent >= 0;

  // Generate points
  const points = dataPoints.map((d, i) => ({
    x: padding.left + (i / (dataPoints.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((getValueForTab(d) - minValue) / valueRange) * chartHeight,
    value: getValueForTab(d),
    date: d.date
  }));

  // Generate smooth curve path using cubic bezier
  const generateSmoothPath = () => {
    if (points.length < 2) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const tension = 0.3;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const linePath = generateSmoothPath();
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;
  const activeColor = tabs[activeTab].color;

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(tabs) as Array<keyof typeof tabs>).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tabKey
              ? 'text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            style={activeTab === tabKey ? { backgroundColor: tabs[tabKey].color } : {}}
          >
            {tabs[tabKey].label}
          </button>
        ))}
      </div>

      {/* Header with current value */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tabs[activeTab].label} Trend</p>
          <h3 className="text-1xl font-bold tracking-tight mt-1" style={{ color: activeColor }}>{lastValue}%</h3>
        </div>
        <div
          className="px-3 py-1.5 rounded-lg flex items-center gap-1"
          style={{ backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
        >
          <span
            className="material-symbols-outlined text-lg"
            style={{ color: isPositive ? '#10b981' : '#ef4444' }}
          >
            {isPositive ? 'trending_up' : 'trending_down'}
          </span>
          <span
            className="text-sm font-bold"
            style={{ color: isPositive ? '#10b981' : '#ef4444' }}
          >
            {isPositive ? '+' : ''}{changePercent}%
          </span>
        </div>
      </div>

      <svg className="w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={tabs[activeTab].gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={activeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 1, 2].map(i => (
          <line
            key={i}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + (i / 2) * chartHeight}
            y2={padding.top + (i / 2) * chartHeight}
            className="stroke-gray-100 dark:stroke-gray-700"
            strokeWidth="1"
          />
        ))}

        {/* Gradient area under curve */}
        <path d={areaPath} fill={`url(#${tabs[activeTab].gradientId})`} />

        {/* Main trend line */}
        <path
          d={linePath}
          fill="none"
          stroke={activeColor}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={i === points.length - 1 || i === points.length - 2 ? 5 : 0}
            fill={activeColor}
          />
        ))}
      </svg>

      {/* Day labels */}
      <div className="flex justify-between mt-2 px-2">
        {dataPoints.map((point, i) => (
          <p
            key={i}
            className={`text-xs font-bold ${i === dataPoints.length - 1 ? '' : 'text-gray-400'}`}
            style={i === dataPoints.length - 1 ? { color: activeColor } : {}}
          >
            {new Date(point.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
          </p>
        ))}
      </div>
    </div>
  );
}

function AIQualityPanel({ quality }: { quality: MessageQuality }) {
  const renderStars = (score: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            className={`text-sm ${i <= score ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary">smart_toy</span>
        <h4 className="text-lg font-bold">AI Message Quality</h4>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Encouragement</span>
          {renderStars(quality.encouragement)}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Alignment</span>
          {renderStars(quality.alignment)}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Clarity</span>
          {renderStars(quality.clarity)}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Average Score</span>
          <span className="text-xl font-bold text-primary">{quality.average.toFixed(2)}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-3 italic">
        Used internally to improve AI responses
      </p>
    </div>
  );
}

function AtRiskCard({ atRisk, explanation }: { atRisk: AtRiskData; explanation: string | null }) {
  if (atRisk.level === "LOW") return null;

  const isHigh = atRisk.level === "HIGH";
  const bgColor = isHigh ? "bg-red-50 dark:bg-red-900/20" : "bg-amber-50 dark:bg-amber-900/20";
  const borderColor = isHigh ? "border-red-200 dark:border-red-800" : "border-amber-200 dark:border-amber-800";
  const textColor = isHigh ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400";
  const icon = isHigh ? "warning" : "info";

  return (
    <div className={`${bgColor} border ${borderColor} rounded-2xl p-6`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined ${textColor}`}>{icon}</span>
        <p className={`${textColor} text-sm font-bold uppercase tracking-tight`}>
          {isHigh ? "Attention Needed" : "Heads Up"}
        </p>
        {atRisk.confidence > 0 && (
          <span className="text-xs bg-white/50 px-2 py-0.5 rounded">
            Confidence: {(atRisk.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {explanation && (
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">
          {explanation}
        </p>
      )}

      {atRisk.reasons.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Why:</p>
          <ul className="space-y-1">
            {atRisk.reasons.map((reason, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/chat"
        className={`mt-4 inline-flex items-center gap-2 px-4 py-2 ${isHigh ? 'bg-red-500' : 'bg-amber-500'} text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity`}
      >
        Talk to Pulse AI
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </div>
  );
}

function DailyPulseCard({ microLabel, motivationLabel, message }: {
  microLabel: string;
  motivationLabel: string;
  message: string;
}) {
  // Map motivation label to color/icon
  const getBandStyle = () => {
    if (motivationLabel === "High momentum") {
      return { icon: "rocket_launch", color: "text-emerald-500", bg: "bg-emerald-500/10" };
    } else if (motivationLabel === "Steady progress") {
      return { icon: "favorite", color: "text-amber-500", bg: "bg-amber-500/10" };
    } else {
      return { icon: "spa", color: "text-blue-500", bg: "bg-blue-500/10" };
    }
  };
  const bandStyle = getBandStyle();

  return (
    <div className="bg-gradient-to-br from-primary/5 to-indigo-100/50 dark:from-primary/10 dark:to-indigo-900/20 rounded-2xl p-6 border border-primary/10">
      <div className="flex items-center gap-2 mb-2">
        <span className={`material-symbols-outlined ${bandStyle.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{bandStyle.icon}</span>
        <span className={`text-xs font-bold ${bandStyle.color} uppercase tracking-widest ${bandStyle.bg} px-2 py-0.5 rounded`}>{motivationLabel}</span>
      </div>
      <h3 className="text-2xl font-bold mb-3">{microLabel}</h3>
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
    </div>
  );
}

// ----- Main Insights Page -----

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
            <div className="flex justify-center items-center py-20">
              <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
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
                />

                {/* Motivation Breakdown */}
                <MotivationBreakdownCard breakdown={insights.motivation_breakdown} />

                {/* Motivation Trend */}
                <MotivationTrendSparkline history={insights.motivation_history} />
              </div>

              <div className="space-y-6">
                {/* AI Quality Panel */}
                <AIQualityPanel quality={insights.message_quality} />

                {/* Quick Stats - Risk Status only (score shown in trend card) */}
                <div className="bg-white dark:bg-white/5 rounded-2xl p-5 shadow-sm border border-black/5 dark:border-white/10">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wider">Risk Status</p>
                  <p className="text-lg font-bold mt-2">
                    {insights.at_risk.level === "LOW" && "✓ No concerns detected"}
                    {insights.at_risk.level === "MEDIUM" && "⚠ Needs attention"}
                    {insights.at_risk.level === "HIGH" && "⚠ At risk of disengagement"}
                  </p>
                </div>

                {/* Opik Badge - Judge Appeal */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-emerald-400">monitoring</span>
                    <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest">Opik Traced</p>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    All insights are computed with full observability. Every decision is traceable.
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    Thread: motivation-{userId}
                  </p>
                </div>
              </div>
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
