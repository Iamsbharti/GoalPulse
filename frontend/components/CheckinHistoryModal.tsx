"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, X } from "lucide-react";

interface Checkin {
  id: string;
  goal_id: string;
  user_id: string;
  progress: string;
  mood: string;
  response: string;
  created_at: string;
}

interface CheckinHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalId: string;
  goalTitle: string;
}

const moodEmojis: Record<string, string> = {
  "1": "😫",
  "2": "😕",
  "3": "😐",
  "4": "🙂",
  "5": "🤩",
  GREAT: "🤩",
  GOOD: "🙂",
  OKAY: "😐",
  FRUSTRATED: "😕",
  OVERWHELMED: "😫",
};

export function CheckinHistoryModal({ isOpen, onClose, goalId, goalTitle }: CheckinHistoryModalProps) {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch when modal opens AND we haven't fetched for this goal yet
    if (isOpen && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchCheckins();
    }
  }, [isOpen, goalId]);

  const fetchCheckins = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/goals/${goalId}/checkins`);
      const data = await response.json();
      setCheckins(data.checkins || []);
    } catch (error) {
      console.error("Error fetching checkins:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset fetched ref when modal closes
  useEffect(() => {
    if (!isOpen) {
      fetchedRef.current = false;
      setCheckins([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getProgressColor = (progress: string) => {
    switch (progress) {
      case "YES":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "PARTIAL":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "NO":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getMoodEmoji = (mood: string) => {
    switch (mood) {
      case "GREAT":
        return "😊";
      case "OKAY":
        return "😐";
      case "LOW":
        return "😔";
      default:
        return "😐";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl w-full max-w-lg max-h-[80vh] shadow-2xl flex flex-col animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[#121217] dark:text-white">Check-in History</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{goalTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary w-8 h-8" />
            </div>
          ) : checkins.length === 0 ? (
            <div className="text-center py-12">
              <div className="size-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-gray-400">history</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400">No check-ins yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Complete a check-in to see your history here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {checkins.map((checkin) => (
                <div
                  key={checkin.id}
                  className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${getProgressColor(checkin.progress)}`}>
                      {checkin.progress}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {getMoodEmoji(checkin.mood)} {checkin.mood}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {formatDate(checkin.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {checkin.response}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}