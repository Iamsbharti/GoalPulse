"use client";

import { useState } from "react";
import Link from "next/link";

// ----- Types -----
export interface MotivationBreakdown {
    score: number;
    consistency: number;
    vibe: number;
}

export interface MotivationHistoryPoint {
    date: string;
    score: number;
    consistency: number | null;
    vibe: number | null;
}

export interface MessageQuality {
    encouragement: number;
    alignment: number;
    clarity: number;
    average: number;
}

export interface AtRiskData {
    level: string;
    confidence: number;
    reasons: string[];
}

export interface InsightsData {
    goal_id: string;
    micro_label: string;
    motivation_label: string;
    message: string;
    show_alert: boolean;
    alert_explanation: string | null;
    motivation_breakdown: MotivationBreakdown;
    motivation_history: MotivationHistoryPoint[];
    message_quality: MessageQuality;
    at_risk: AtRiskData;
    _debug: any;
}

// ----- Components -----

export function MotivationBreakdownCard({ breakdown }: { breakdown: MotivationBreakdown }) {
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

export function MotivationTrendSparkline({ history }: { history: MotivationHistoryPoint[] }) {
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

    // Check if all history points are from the same day
    const allSameDay = history.length > 1 && history.every(h =>
        new Date(h.date).toDateString() === new Date(history[0].date).toDateString()
    );

    let processedHistory: MotivationHistoryPoint[] = [];

    if (allSameDay) {
        // Intraday mode: Show all points sorted by time
        processedHistory = [...history].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    } else {
        // Interday mode: Deduplicate by date (take latest per day)
        const dailyHistory = history.reduce((acc, point) => {
            const dateKey = new Date(point.date).toLocaleDateString();
            acc[dateKey] = point;
            return acc;
        }, {} as Record<string, MotivationHistoryPoint>);

        processedHistory = Object.values(dailyHistory).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    }

    const dataPoints = processedHistory.slice(-7);

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
    const points = dataPoints.map((d, i) => {
        let xPosition;
        if (dataPoints.length === 1) {
            xPosition = width / 2; // Center if only one point
        } else {
            xPosition = padding.left + (i / (dataPoints.length - 1)) * chartWidth;
        }

        return {
            x: xPosition,
            y: padding.top + chartHeight - ((getValueForTab(d) - minValue) / (valueRange || 1)) * chartHeight, // Avoid div by zero if range is 0
            value: getValueForTab(d),
            date: d.date
        };
    });

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
    // Only generate area path if we have a line path
    const areaPath = linePath
        ? `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
        : "";
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

            {/* Labels (Adaptive: Time vs Day) */}
            <div className="flex justify-between mt-2 px-2">
                {dataPoints.map((point, i) => (
                    <p
                        key={i}
                        className={`text-xs font-bold ${i === dataPoints.length - 1 ? '' : 'text-gray-400'}`}
                        style={i === dataPoints.length - 1 ? { color: activeColor } : {}}
                    >
                        {allSameDay
                            ? new Date(point.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                            : new Date(point.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
                        }
                    </p>
                ))}
            </div>
        </div>
    );
}

export function AIQualityPanel({ quality }: { quality: MessageQuality }) {
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

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Encouragement</span>
                    {renderStars(quality.encouragement)}
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Tone Alignment</span>
                    {renderStars(quality.alignment)}
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Clarity</span>
                    {renderStars(quality.clarity)}
                </div>
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <span className="font-bold text-sm">Overall Score</span>
                    <span className="font-bold text-amber-500 text-lg">{quality.average}</span>
                </div>
            </div>
            <p className="text-xs text-center text-gray-400 mt-4">Scored by LLM-as-a-Judge</p>
        </div>
    );
}

export function AtRiskCard({ atRisk, explanation, goalId }: { atRisk: AtRiskData; explanation: string | null; goalId: string }) {
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
                href={`/chat?goalId=${goalId}`}
                className={`mt-4 inline-flex items-center gap-2 px-4 py-2 ${isHigh ? 'bg-red-500' : 'bg-amber-500'} text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity`}
            >
                Talk to Coach Aura
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
        </div>
    );
}

export function DailyPulseCard({ microLabel, motivationLabel, message }: {
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

export function InsightsRightPanel({ insights, goalId }: { insights: InsightsData; goalId: string }) {
    return (
        <div className="space-y-6">
            <AIQualityPanel quality={insights.message_quality || { encouragement: 0, alignment: 0, clarity: 0, average: 0 }} />

            {/* Risk Status Card */}
            <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-gray-400">shield</span>
                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Risk Status</h4>
                </div>

                {insights.at_risk.level === "LOW" ? (
                    <div className="flex items-center gap-2 text-emerald-500">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        <span className="text-sm font-bold">No concerns detected</span>
                    </div>
                ) : (
                    <AtRiskCard
                        atRisk={insights.at_risk}
                        explanation={insights.alert_explanation}
                        goalId={goalId}
                    />
                )}
            </div>

            {/* Opik Traced Card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-emerald-400">monitoring</span>
                    <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest">Opik Traced</p>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                    All insights are computed with full observability. Every decision is traceable.
                </p>
                <p className="text-xs text-gray-500 mt-3">
                    Thread: {insights._debug?.thread_id || "N/A"}
                </p>
            </div>
        </div>
    );
}
