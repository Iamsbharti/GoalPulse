"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Sparkles, Plus, Trash2 } from "lucide-react";

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  createdAt: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const fetchGoals = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/goals?userId=neo`);
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
  }, []);

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

  const createGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category: "productivity", // Hardcoded
        }),
      });

      if (response.ok) {
        setTitle("");
        setDescription("");
        setIsCreating(false);
        fetchGoals();
      }
    } catch (error) {
      console.error("Error creating goal:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-primary-600 text-white p-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            🎯 GoalPulse
          </Link>
          <Link href="/chat" className="text-sm hover:underline flex items-center gap-2">
            ← Back to Chat
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Your Goals</h1>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus size={20} />
            {isCreating ? "Cancel" : "Set New Goal"}
          </button>
        </div>

        {isCreating && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-xl font-semibold mb-4">Create a New Goal</h2>
            <form onSubmit={createGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Read 12 books this year"
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your goal and how you plan to achieve it..."
                    rows={3}
                    className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={generateDescription}
                    disabled={!title || isGenerating}
                    className="absolute bottom-2 right-2 flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 disabled:opacity-50 transition"
                  >
                    {isGenerating ? (
                      <Loader2 className="animate-spin" size={12} />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    Generate with AI
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Tip: Provide a title, then use AI to generate a motivating description.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary-600" size={32} />
          </div>
        ) : goals.length === 0 && !isCreating ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
            <p className="text-gray-500 mb-4">You haven't set any goals yet.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="text-primary-600 font-medium hover:underline"
            >
              Get started by setting one now!
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="bg-white rounded-xl shadow-sm p-6 border hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {goal.title}
                    </h3>
                    <p className="text-gray-600 mt-1 text-sm">
                      {goal.description}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {goal.status}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {goal.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
