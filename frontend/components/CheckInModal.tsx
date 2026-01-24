"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { MOOD_LIST, MOODS } from "@/lib/mood-constants";

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalId: string;
  goalTitle: string;
  onCheckInComplete: () => void;
}

export function CheckInModal({ isOpen, onClose, goalId, goalTitle, onCheckInComplete }: CheckInModalProps) {
  const [progress, setProgress] = useState("YES");
  const [mood, setMood] = useState<string>(MOODS.GOOD.value);
  const [response, setResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!response.trim()) return;

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/goals/${goalId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress, mood, response }),
      });

      if (res.ok) {
        setResponse("");
        onCheckInComplete();
        onClose();
      }
    } catch (error) {
      console.error("Error submitting check-in:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-[#121217] dark:text-white">Check In</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{goalTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-[#121217] dark:text-white mb-3">
              Did you work on this goal?
            </label>
            <div className="flex gap-2">
              {["YES", "PARTIAL", "NO"].map((option) => (
                <button
                  key={option}
                  onClick={() => setProgress(option)}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${progress === option
                    ? option === "YES"
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/25"
                      : option === "PARTIAL"
                        ? "bg-yellow-500 text-white shadow-lg shadow-yellow-500/25"
                        : "bg-red-500 text-white shadow-lg shadow-red-500/25"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#121217] dark:text-white mb-3">
              How did it feel?
            </label>
            <div className="flex justify-between bg-[#f0f0f4] dark:bg-gray-800 p-3 rounded-xl">
              {MOOD_LIST.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${mood === m.value
                    ? "bg-white dark:bg-gray-700 shadow-sm scale-110"
                    : "hover:bg-white/30 dark:hover:bg-white/10 filter grayscale hover:grayscale-0"
                    }`}
                  title={m.label}
                >
                  <span className="text-2xl">{m.emoji}</span>
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              {MOOD_LIST.find((m) => m.value === mood)?.label}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#121217] dark:text-white mb-3">
              What did you do?
            </label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Briefly describe what you accomplished..."
              rows={3}
              className="w-full rounded-xl border-none bg-gray-50 dark:bg-gray-800 p-4 text-sm focus:ring-2 focus:ring-primary placeholder:text-gray-400 text-[#121217] dark:text-white resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!response.trim() || isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-primary text-white rounded-xl font-bold hover:bg-[#4338ca] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                <span>Submit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}