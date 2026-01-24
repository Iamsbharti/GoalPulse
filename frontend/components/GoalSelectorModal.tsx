"use client";

import { X } from "lucide-react";

interface Goal {
    id: string;
    title: string;
    progress: number;
    icon: string;
    category: string;
}

interface GoalSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    goals: Goal[];
    onGoalSelect: (goal: Goal) => void;
}

export function GoalSelectorModal({ isOpen, onClose, goals, onGoalSelect }: GoalSelectorModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-bold text-[#121217] dark:text-white">Quick Check-in</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select a goal to update</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                    {goals.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500">No active goals found.</p>
                        </div>
                    ) : (
                        goals.map((goal) => (
                            <button
                                key={goal.id}
                                onClick={() => onGoalSelect(goal)}
                                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                            >
                                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-primary text-2xl">{goal.icon}</span>
                                </div>
                                <div className="flex-1 text-left">
                                    <h3 className="font-bold text-[#121217] dark:text-white">{goal.title}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{goal.category}</p>
                                </div>
                                <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
