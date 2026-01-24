"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";

interface AddResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoalCreated: () => void;
}

interface CoachPersona {
    id: string;
    name: string;
    description: string;
    icon: string;
    iconBg: string;
    iconColor: string;
}

const personas: CoachPersona[] = [
    { id: "cheerleader", name: "Cheerleader", description: "High energy, constant encouragement and positivity.", icon: "sentiment_very_satisfied", iconBg: "bg-yellow-100", iconColor: "text-yellow-600" },
    { id: "analytical", name: "Analytical", description: "Data-driven insights, focus on patterns and logic.", icon: "monitoring", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
    { id: "tough_love", name: "Tough Love", description: "No excuses, direct communication and high-accountability.", icon: "military_tech", iconBg: "bg-red-100", iconColor: "text-red-600" },
];

export function AddResolutionModal({ isOpen, onClose, onGoalCreated }: AddResolutionModalProps) {
    const [step, setStep] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState("health");
    const [selectedPersona, setSelectedPersona] = useState("cheerleader");

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [titleError, setTitleError] = useState(false);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const selectedCategoryData = CATEGORIES.find(c => c.id === selectedCategory);
    const selectedPersonaData = personas.find(p => p.id === selectedPersona);
    const progressWidth = ((step + (step === 4 ? 0.5 : 0)) / 4.5) * 100;

    const generateDescription = async () => {
        if (!title) return;

        setIsGenerating(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const response = await fetch(`${apiUrl}/api/goals/generate-description`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
            });
            const data = await response.json();
            setDescription(data.description);
        } catch (error) {
            console.error("Error generating description:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const autoGenerateAndCreate = async () => {
        if (!description) {
            await generateDescription();
        }
        await createGoal();
    };

    const createGoal = async () => {
        if (!title) {
            setTitleError(true);
            return;
        }

        setIsSubmitting(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const response = await fetch(`${apiUrl}/api/goals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    category: selectedCategory,
                }),
            });

            if (response.ok) {
                setTitle("");
                setDescription("");
                setStep(1);
                onGoalCreated();
                onClose();
            }
        } catch (error) {
            console.error("Error creating goal:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const nextStep = () => {
        if (step === 1) {
            setStep(2);
        } else if (step === 2) {
            if (!title.trim()) {
                setTitleError(true);
                return;
            }
            setTitleError(false);
            setStep(3);
        } else if (step === 3) {
            setStep(4);
        }
    };

    const prevStep = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-[#121217] dark:text-white">Add New Resolution</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="h-1 bg-gray-100 dark:bg-gray-800 w-full">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressWidth}%` }}></div>
                </div>

                <div className="p-6 lg:p-8">
                    {step === 1 && (
                        <div className="animate-in fade-in">
                            <h3 className="text-lg font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6">1. Find Your Category</h3>
                            <div className="relative mb-6">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400">search</span>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Health, Finance, Productivity..."
                                    className="block w-full p-4 pl-12 text-lg border-none bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm focus:ring-2 focus:ring-primary dark:focus:ring-primary/50 transition-all placeholder:text-gray-400 text-[#121217] dark:text-white"
                                />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all ${selectedCategory === cat.id
                                                ? "bg-primary text-white shadow-lg shadow-primary/25"
                                                : "bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-primary/50"
                                            }`}
                                    >
                                        <span className="material-symbols-outlined">{cat.icon}</span>
                                        <span className="font-medium">{cat.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in fade-in space-y-6">
                            <h3 className="text-lg font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">2. Goal Details</h3>
                            <div className="space-y-6">
                                <div className="flex flex-col gap-3">
                                    <label className="text-lg font-semibold text-[#121217] dark:text-white">
                                        Goal Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => {
                                            setTitle(e.target.value);
                                            if (e.target.value.trim()) setTitleError(false);
                                        }}
                                        placeholder="e.g., Run a Marathon"
                                        className={`w-full rounded-xl border-none bg-gray-50 dark:bg-gray-800 p-4 text-lg shadow-sm focus:ring-2 placeholder:text-gray-400 text-[#121217] dark:text-white ${titleError ? "ring-2 ring-red-500" : "focus:ring-primary dark:focus:ring-primary/50"
                                            }`}
                                    />
                                    {titleError && <p className="text-red-500 text-sm">Please enter a goal name</p>}
                                </div>
                                <div className="flex flex-col gap-3">
                                    <label className="text-lg font-semibold text-[#121217] dark:text-white">Description (Optional)</label>
                                    <div className="relative">
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Describe your goal or leave empty to auto-generate..."
                                            rows={4}
                                            className="w-full rounded-xl border-none bg-gray-50 dark:bg-gray-800 p-4 text-lg shadow-sm focus:ring-2 focus:ring-primary dark:focus:ring-primary/50 placeholder:text-gray-400 text-[#121217] dark:text-white resize-none"
                                        />
                                        <button
                                            onClick={generateDescription}
                                            disabled={!title || isGenerating}
                                            className="absolute bottom-3 right-3 flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 disabled:opacity-50 transition-colors"
                                        >
                                            {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <span className="material-symbols-outlined text-sm">auto_awesome</span>}
                                            Generate with AI
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in fade-in">
                            <h3 className="text-lg font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6">3. Choose Your AI Coach</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {personas.map((persona) => (
                                    <div
                                        key={persona.id}
                                        onClick={() => setSelectedPersona(persona.id)}
                                        className={`relative flex flex-col p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 transition-all cursor-pointer ${selectedPersona === persona.id ? "border-primary bg-primary/5" : "border-transparent hover:border-primary/30"
                                            }`}
                                    >
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${persona.iconBg}`}>
                                            <span className={`material-symbols-outlined text-4xl ${persona.iconColor}`}>{persona.icon}</span>
                                        </div>
                                        <h4 className="text-xl font-bold text-[#121217] dark:text-white mb-2">{persona.name}</h4>
                                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{persona.description}</p>
                                        {selectedPersona === persona.id && (
                                            <div className="absolute top-4 right-4 text-primary">
                                                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="animate-in fade-in">
                            <h3 className="text-lg font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6">4. Preview & Create</h3>

                            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-primary text-2xl">{selectedCategoryData?.icon}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Category</p>
                                        <p className="text-lg font-semibold text-[#121217] dark:text-white">{selectedCategoryData?.name}</p>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Goal Name</p>
                                    <p className="text-xl font-bold text-[#121217] dark:text-white">{title}</p>
                                </div>

                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</p>
                                        {!description && (
                                            <button
                                                onClick={generateDescription}
                                                disabled={isGenerating}
                                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                                            >
                                                {isGenerating ? <Loader2 className="animate-spin" size={12} /> : <span className="material-symbols-outlined text-sm">auto_awesome</span>}
                                                Auto-generate
                                            </button>
                                        )}
                                    </div>
                                    {description ? (
                                        <p className="text-[#121217] dark:text-white leading-relaxed">{description}</p>
                                    ) : (
                                        <p className="text-gray-400 italic">No description set. Click &quot;Auto-generate&quot; to create one.</p>
                                    )}
                                </div>

                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">AI Coach</p>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedPersonaData?.iconBg}`}>
                                            <span className={`material-symbols-outlined text-2xl ${selectedPersonaData?.iconColor}`}>{selectedPersonaData?.icon}</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-[#121217] dark:text-white">{selectedPersonaData?.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedPersonaData?.description}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                        {step > 1 ? (
                            <button
                                onClick={prevStep}
                                className="flex items-center gap-2 px-6 py-3 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                                <span>Previous Step</span>
                            </button>
                        ) : (
                            <div className="w-24"></div>
                        )}

                        {step < 4 ? (
                            <button
                                onClick={nextStep}
                                className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-[#4338ca] text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-95"
                            >
                                <span>Continue</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        ) : (
                            <button
                                onClick={autoGenerateAndCreate}
                                disabled={isGenerating || isSubmitting}
                                className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-[#4338ca] text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isGenerating || isSubmitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>{isGenerating ? 'Generating...' : 'Creating...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">rocket_launch</span>
                                        <span>Create Resolution</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
