"use client";

import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";

interface Goal {
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
}

interface EditResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    goal: Goal;
    onGoalUpdated: () => void;
}

export function EditResolutionModal({ isOpen, onClose, goal, onGoalUpdated }: EditResolutionModalProps) {
    const [title, setTitle] = useState(goal.title);
    const [description, setDescription] = useState(goal.description);
    const [selectedCategory, setSelectedCategory] = useState(goal.category);
    const [status, setStatus] = useState(goal.status);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when goal changes
    useEffect(() => {
        setTitle(goal.title);
        setDescription(goal.description);
        setSelectedCategory(goal.category);
        setStatus(goal.status);
    }, [goal]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const response = await fetch(`${apiUrl}/api/goals/${goal.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    category: selectedCategory,
                    status,
                }),
            });

            if (response.ok) {
                onGoalUpdated();
                onClose();
            }
        } catch (error) {
            console.error("Error updating goal:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-[#121217] dark:text-white">Edit Resolution</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 lg:p-8 space-y-6">
                    <div className="flex flex-col gap-3">
                        <label className="text-lg font-semibold text-[#121217] dark:text-white">
                            Goal Name
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-xl border-none bg-gray-50 dark:bg-gray-800 p-4 text-lg shadow-sm focus:ring-2 focus:ring-primary dark:focus:ring-primary/50 text-[#121217] dark:text-white"
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <label className="text-lg font-semibold text-[#121217] dark:text-white">Category</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${selectedCategory === cat.id
                                        ? "bg-primary text-white shadow-lg shadow-primary/25"
                                        : "bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-primary/50"
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                                    <span className="font-medium">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <label className="text-lg font-semibold text-[#121217] dark:text-white">Status</label>
                        <div className="flex gap-2">
                            {['ACTIVE', 'COMPLETED', 'PAUSED'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setStatus(s)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${status === s
                                        ? "bg-primary text-white shadow-lg shadow-primary/25"
                                        : "bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-primary/50"
                                        }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <label className="text-lg font-semibold text-[#121217] dark:text-white">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className="w-full rounded-xl border-none bg-gray-50 dark:bg-gray-800 p-4 text-lg shadow-sm focus:ring-2 focus:ring-primary dark:focus:ring-primary/50 text-[#121217] dark:text-white resize-none"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-[#4338ca] text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">save</span>
                                    <span>Save Changes</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
