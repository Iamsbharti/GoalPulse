"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { CheckInModal } from "@/components/CheckInModal";
import { CheckinHistoryModal } from "@/components/CheckinHistoryModal";
import { EditResolutionModal } from "@/components/EditResolutionModal";
import GoalInsightsModal from "@/components/GoalInsightsModal";

// ... (Goal, CoachPersona interfaces - keeping same)
// ... (personas array - keeping same)
// ... (CATEGORIES, STATUS_COLORS imports - keeping same)

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  createdAt: string;
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

import { CATEGORIES } from "@/lib/constants";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";

export default function GoalsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState("cheerleader");
  const [selectedCategory, setSelectedCategory] = useState("health");
  const [step, setStep] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [titleError, setTitleError] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Modal state
  const [checkInModalGoal, setCheckInModalGoal] = useState<{ id: string; title: string } | null>(null);
  const [historyModalGoal, setHistoryModalGoal] = useState<{ id: string; title: string } | null>(null);
  const [insightsModalGoal, setInsightsModalGoal] = useState<{ id: string; title: string } | null>(null);

  // Edit/Delete state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedCategoryData = CATEGORIES.find(c => c.id === selectedCategory);
  const selectedPersonaData = personas.find(p => p.id === selectedPersona);

  const fetchGoals = async () => {
    if (!user) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/goals?userId=${user.id}`);
      const data = await response.json();
      setGoals(data.goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [refreshKey, user]);

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
    await createGoal(new Event("submit") as unknown as React.FormEvent);
  };

  const createGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      setTitleError(true);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/goals?userId=${user?.id}`, {
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
        setIsCreating(false);
        fetchGoals();
      }
    } catch (error) {
      console.error("Error creating goal:", error);
    }
  };

  const confirmDelete = async () => {
    if (!deletingGoal) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/goals/${deletingGoal.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRefreshKey(prev => prev + 1);
        setActiveMenuId(null);
        setDeletingGoal(null);
      }
    } catch (error) {
      console.error("Error deleting goal:", error);
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

  const progressWidth = ((step + (step === 4 ? 0.5 : 0)) / 4.5) * 100;

  if (isCreating) {
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
            <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <span className="material-symbols-outlined">home</span>
              {isSidebarOpen && <span className="font-medium">Dashboard</span>}
            </Link>
            <Link href="/chat" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <span className="material-symbols-outlined">forum</span>
              {isSidebarOpen && <span className="font-medium">Pulse AI</span>}
            </Link>
            <Link href="/goals" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>track_changes</span>
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
                  <p className="text-sm font-medium text-[#121217] dark:text-white">{user?.name || "User"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pro Member</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-h-screen">
          <header className="flex items-center bg-white dark:bg-[#121217] px-4 lg:px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
            <button
              onClick={() => {
                setIsCreating(false);
                setStep(1);
              }}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-2 lg:mr-4"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex-1">
              <h2 className="text-lg lg:text-2xl font-bold text-[#121217] dark:text-white">Add New Resolution</h2>
            </div>
          </header>

          <main className="p-4 lg:p-8 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 overflow-hidden">
              <div className="h-2 bg-gray-100 dark:bg-gray-800 w-full">
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
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-[#4338ca] text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          <span>Generating...</span>
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
            <button onClick={() => setIsCreating(true)} className="flex flex-col items-center gap-1 text-primary">
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
      </div>
    );
  }

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
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">home</span>
            {isSidebarOpen && <span className="font-medium">Dashboard</span>}
          </Link>
          <Link href="/chat" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">forum</span>
            {isSidebarOpen && <span className="font-medium">Pulse AI</span>}
          </Link>
          <Link href="/goals" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>track_changes</span>
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
                <p className="text-sm font-medium text-[#121217] dark:text-white">{user?.name || "User"}</p>
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
            <h2 className="text-2xl font-bold text-[#121217] dark:text-white">Your Resolutions</h2>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-[#4338ca] transition-colors shadow-lg shadow-primary/25">
              <span className="material-symbols-outlined">add</span>
              <span>New Goal</span>
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
            <h2 className="text-xl font-bold text-[#121217] dark:text-white">Your Resolutions</h2>
            <div className="w-16"></div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 animate-pulse">Loading Your Resolutions...</p>
            </div>
          ) : goals.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="size-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-gray-400">track_changes</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-lg">You haven't set any goals yet.</p>
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-[#4338ca] transition-colors shadow-lg shadow-primary/25"
              >
                <span className="material-symbols-outlined">add</span>
                <span>Get started by setting one now!</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {goals.map((goal) => (
                <div key={goal.id} className="bg-white dark:bg-white/5 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-[#121217] dark:text-white">{goal.title}</h3>
                      <p className="text-gray-500 dark:text-gray-400 mt-2">{goal.description}</p>
                      <div className="flex gap-2 mt-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          {goal.status}
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 capitalize">
                          {goal.category}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === goal.id ? null : goal.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>

                      {activeMenuId === goal.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)}></div>
                          <div className="absolute right-0 top-10 w-48 bg-white dark:bg-[#1a1a2e] rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <button
                              onClick={() => {
                                setEditingGoal(goal);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                              Edit Resolution
                            </button>
                            <button
                              onClick={() => setDeletingGoal(goal)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setCheckInModalGoal({ id: goal.id, title: goal.title })}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors"
                    >
                      <span className="material-symbols-outlined">check_circle</span>
                      <span>Check In</span>
                    </button>
                    <button
                      onClick={() => setHistoryModalGoal({ id: goal.id, title: goal.title })}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="material-symbols-outlined">history</span>
                      <span>History</span>
                    </button>
                    <button
                      onClick={() => setInsightsModalGoal({ id: goal.id, title: goal.title })}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-xl font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                      <span className="material-symbols-outlined">analytics</span>
                      <span>Insights</span>
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setIsCreating(true)}
                className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all cursor-pointer min-h-[150px]"
              >
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl">add</span>
                </div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Add New Goal</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {checkInModalGoal && (
        <CheckInModal
          isOpen={true}
          onClose={() => setCheckInModalGoal(null)}
          goalId={checkInModalGoal.id}
          goalTitle={checkInModalGoal.title}
          onCheckInComplete={() => setRefreshKey(prev => prev + 1)}
        />
      )}

      {historyModalGoal && (
        <CheckinHistoryModal
          isOpen={true}
          onClose={() => setHistoryModalGoal(null)}
          goalId={historyModalGoal.id}
          goalTitle={historyModalGoal.title}
        />
      )}

      {insightsModalGoal && (
        <GoalInsightsModal
          isOpen={true}
          onClose={() => setInsightsModalGoal(null)}
          goalId={insightsModalGoal.id}
        />
      )}

      {editingGoal && (
        <EditResolutionModal
          isOpen={true}
          onClose={() => setEditingGoal(null)}
          goal={editingGoal}
          onGoalUpdated={() => setRefreshKey(prev => prev + 1)}
        />
      )}

      <DeleteConfirmationModal
        isOpen={!!deletingGoal}
        onClose={() => setDeletingGoal(null)}
        onConfirm={confirmDelete}
        title="Delete Resolution?"
        description={`Are you sure you want to delete "${deletingGoal?.title}"? This action cannot be undone.`}
      />

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
          <button onClick={() => setIsCreating(true)} className="flex flex-col items-center gap-1 text-primary">
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
    </div>
  );
}
