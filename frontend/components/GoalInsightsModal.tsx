"use client";

import { useState, useEffect, useRef } from "react";
import {
    MotivationBreakdownCard,
    MotivationTrendSparkline,
    AIQualityPanel,
    AtRiskCard,
    DailyPulseCard,
    InsightsData,
    InsightsRightPanel
} from "./InsightsComponents";

interface GoalInsightsModalProps {
    goalId: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function GoalInsightsModal({ goalId, isOpen, onClose }: GoalInsightsModalProps) {
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const lastFetchedGoalId = useRef<string | null>(null);

    // In production, this comes from auth context
    const userId = "neo";

    // Reset fetch state when modal closes so it refetches next time
    useEffect(() => {
        if (!isOpen) {
            lastFetchedGoalId.current = null;
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !goalId) return;

        // Prevent double fetch (Strict Mode)
        if (lastFetchedGoalId.current === goalId) return;

        // New fetch needed
        lastFetchedGoalId.current = goalId;
        setInsights(null);
        setIsLoading(true);

        const fetchInsights = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const response = await fetch(`${apiUrl}/api/insights/goals/${goalId}?userId=${userId}`);

                if (response.ok) {
                    const data = await response.json();
                    setInsights(data);
                }
            } catch (error) {
                console.error("Error fetching goal insights:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInsights();
    }, [goalId, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-6xl bg-white dark:bg-[#121217] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#121217] z-10">
                    <h2 className="text-lg font-bold">Goal Insights</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <span className="material-symbols-outlined text-gray-500">close</span>
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-black/20">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500 animate-pulse">Analyzing goal motivation...</p>
                        </div>
                    ) : insights ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left Column: Main Message & Breakdown */}
                            <div className="lg:col-span-2 space-y-6">
                                <DailyPulseCard
                                    microLabel={insights.micro_label}
                                    motivationLabel={insights.motivation_label}
                                    message={insights.message}
                                />

                                <h3 className="text-lg font-bold px-1">Motivation Analysis</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <MotivationBreakdownCard breakdown={insights.motivation_breakdown} />
                                    <MotivationTrendSparkline history={insights.motivation_history} />
                                </div>
                            </div>

                            {/* Right Column: Risks & Quality */}
                            <InsightsRightPanel insights={insights} />
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">cloud_off</span>
                            <p className="text-gray-500">Failed to load insights. Please try again.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
