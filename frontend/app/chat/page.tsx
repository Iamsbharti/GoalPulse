"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  loading: () => <span className="text-gray-400">Loading...</span>,
});

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
}

interface GoalDraft {
  title: string;
  description: string;
  category: string;
  suggested_checkin_frequency_days: number;
}

const quickReplies = [
  { id: "back_on_track", text: "I'm back on track 🏃", icon: "directions_run" },
  { id: "need_boost", text: "Need a boost ⚡", icon: "bolt" },
  { id: "reschedule", text: "Let's reschedule 📅", icon: "event" },
  { id: "skip_today", text: "Skip for today ⏭️", icon: "schedule" },
  { id: "check_progress", text: "How am I doing? 📊", icon: "bar_chart" },
];

const DEFAULT_WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hey there! I'm your GoalPulse AI coach. How are you doing with your goals today?",
  timestamp: new Date().toISOString(),
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLElement>(null);
  const inputRef = useRef(input);

  // Goal creation state
  const [pendingGoalDraft, setPendingGoalDraft] = useState<GoalDraft | null>(null);
  const [isProcessingGoal, setIsProcessingGoal] = useState(false);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > 0 && mainContainerRef.current) {
      mainContainerRef.current.scrollTop = mainContainerRef.current.scrollHeight;
    }
  }, [messages.length, hasInitialized]);

  const fetchGoals = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/goals?userId=neo`);
      const data = await response.json();
      setGoals(data.goals || []);
    } catch (error) {
      console.error("Error fetching goals:", error);
    }
  }, []);

  const isValidMessage = (msg: unknown): msg is Message => {
    if (!msg || typeof msg !== 'object') return false;
    const m = msg as Record<string, unknown>;
    return (
      typeof m.id === 'string' &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' &&
      typeof m.timestamp === 'string'
    );
  };

  const isValidMessagesArray = (data: unknown): data is Message[] => {
    if (!Array.isArray(data)) return false;
    return data.every(isValidMessage);
  };

  const initializeChat = async () => {
    if (hasInitialized) return;

    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      // Fetch goals
      await fetchGoals();

      // Show welcome message
      setMessages([DEFAULT_WELCOME_MESSAGE]);

      setHasInitialized(true);
    } catch (error) {
      console.error("Error initializing chat:", error);
      setMessages([DEFAULT_WELCOME_MESSAGE]);
      setHasInitialized(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  const clearChat = () => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setPendingGoalDraft(null);
  };

  const processGoalMessage = async (messageText: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          userId: "neo",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process message");
      }

      const data = await response.json();

      if (data.has_goal_intent) {
        if (data.cancelled) {
          setPendingGoalDraft(null);
        }

        if (data.goal_created && data.goal) {
          // Goal was successfully created
          setPendingGoalDraft(null);
          await fetchGoals();

          const ackMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.message,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, ackMessage]);
        } else if (data.needs_clarification && data.goal_draft) {
          // Store the goal draft for continuation
          setPendingGoalDraft(data.goal_draft);

          const clarificationMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.message,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, clarificationMessage]);
        } else if (data.needs_confirmation && data.goal_draft) {
          // Show goal preview for confirmation
          setPendingGoalDraft(data.goal_draft);

          const previewMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.message,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, previewMessage]);
        } else {
          // Regular response
          const responseMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.message,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, responseMessage]);
        }
      } else {
        // No goal intent, use regular chat
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error processing goal message:", error);
      return false;
    }
  };

  const confirmGoal = async () => {
    if (!pendingGoalDraft) return;

    setIsProcessingGoal(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/goals/from-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pendingGoalDraft.title,
          description: pendingGoalDraft.description,
          category: pendingGoalDraft.category,
          checkin_frequency_days: pendingGoalDraft.suggested_checkin_frequency_days,
          userId: "neo",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create goal");
      }

      const data = await response.json();

      if (data.success) {
        // Show acknowledgment message
        const ackMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.acknowledgment,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, ackMessage]);

        // Refresh goals list
        await fetchGoals();

        // Clear pending goal
        setPendingGoalDraft(null);
      }
    } catch (error) {
      console.error("Error creating goal:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I had trouble saving that goal. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessingGoal(false);
    }
  };

  const editGoal = () => {
    // Allow user to edit the goal in natural language
    const editMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Sure! Tell me what you'd like to change about this goal.",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, editMessage]);
    setPendingGoalDraft(null);
  };

  const sendMessage = useCallback(async (messageText?: string) => {
    const textToSend = messageText || inputRef.current.trim();
    if (!textToSend || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      // First, try to process as a goal creation message
      const processed = await processGoalMessage(textToSend);

      if (!processed) {
        // Use regular chat if no goal intent
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: textToSend,
            userId: "neo",
            goalId: selectedGoal,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const data = await response.json();

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response || "I'm here to help! Tell me more about your goals.",
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again later.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  }, [isSending, selectedGoal]);

  const selectedGoalData = useMemo(() =>
    goals.find(g => g.id === selectedGoal) || null
    , [goals, selectedGoal]);

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
          <Link href="/chat" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
            {isSidebarOpen && <span className="font-medium">Pulse AI</span>}
          </Link>
          <Link href="/goals" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">track_changes</span>
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
                <p className="text-sm font-medium text-[#121217] dark:text-white">Neo</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pro Member</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="hidden lg:flex items-center bg-white dark:bg-[#121217] px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-4">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 aspect-square rounded-full w-10 h-10 shrink-0 flex items-center justify-center overflow-hidden border border-primary/20">
              <div className="w-full h-full bg-gradient-to-tr from-primary to-indigo-300 opacity-80"></div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold leading-tight tracking-tight text-[#121217] dark:text-white">Coach Aura</h2>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p className="text-xs text-[#686586] dark:text-gray-400 font-medium">Your AI Accountability Partner</p>
            </div>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearChat}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">refresh</span>
              <span className="hidden lg:inline">New Chat</span>
            </button>
            <button className="p-2 text-[#686586] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
          {goals.length > 0 && (
            <div className="px-4 lg:px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              {/* <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setSelectedGoal(null)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedGoal === null
                    ? "bg-primary text-white"
                    : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-primary/50"
                    }`}
                >
                  <span className="material-symbols-outlined text-sm">all_inclusive</span>
                  All Goals
                </button>
                {goals.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoal(goal.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedGoal === goal.id
                      ? "bg-primary text-white"
                      : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-primary/50"
                      }`}
                  >
                    <span className="material-symbols-outlined text-sm">track_changes</span>
                    {goal.title.length > 15 ? goal.title.substring(0, 15) + "..." : goal.title}
                  </button>
                ))}
              </div> */}
            </div>
          )}

          <ErrorBoundary>
            <main ref={mainContainerRef} className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 no-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <div className="w-full h-full bg-gradient-to-tr from-primary to-indigo-300 opacity-80 animate-pulse"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading your conversation...</p>
                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-3xl">forum</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Start a conversation with Coach Aura</p>
                    </div>
                  )}
                  {messages.map((message) => (
                    <div key={message.id} className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
                      {message.role === "assistant" && (
                        <div className="flex items-start gap-4 w-full max-w-3xl">
                          <div className="bg-primary/10 dark:bg-primary/20 aspect-square rounded-full w-10 h-10 shrink-0 flex items-center justify-center overflow-hidden border border-primary/20 mt-1">
                            <div className="w-full h-full bg-gradient-to-tr from-primary to-indigo-300 opacity-80"></div>
                          </div>
                          <div className="flex flex-col gap-1 items-start">
                            <p className="text-[#686586] dark:text-gray-400 text-xs font-bold uppercase tracking-widest ml-1">Coach Aura</p>
                            <div className="bg-white dark:bg-gray-800 text-[#121217] dark:text-white text-base font-normal leading-relaxed rounded-2xl rounded-tl-none px-5 py-4 shadow-sm border border-gray-100 dark:border-gray-700">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )}
                      {message.role === "user" && (
                        <div className="flex flex-col items-end gap-1 max-w-2xl">
                          <div className="bg-primary text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-sm">
                            <p className="text-sm">{message.content}</p>
                          </div>
                          <span className="text-[10px] text-gray-400 mr-1">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex items-center gap-1 ml-14">
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  )}

                  {/* Goal Preview Card */}
                  {pendingGoalDraft && (
                    <div className="flex flex-col items-start gap-4 w-full max-w-3xl ml-14">
                      <div className="bg-white dark:bg-gray-800 text-[#121217] dark:text-white text-base font-normal leading-relaxed rounded-2xl rounded-tl-none px-5 py-4 shadow-sm border border-gray-100 dark:border-gray-700 w-full">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">task_alt</span>
                            <p className="text-sm font-bold uppercase tracking-widest text-[#686586] dark:text-gray-400">Goal Preview</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Title</p>
                            <p className="font-bold text-[#121217] dark:text-white">{pendingGoalDraft.title}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Description</p>
                            <p className="text-gray-600 dark:text-gray-300">{pendingGoalDraft.description}</p>
                          </div>
                          <div className="flex gap-4">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Category</p>
                              <p className="font-medium text-[#121217] dark:text-white capitalize">{pendingGoalDraft.category}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Check-in Frequency</p>
                              <p className="font-medium text-[#121217] dark:text-white">{pendingGoalDraft.suggested_checkin_frequency_days} days</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={confirmGoal}
                            disabled={isProcessingGoal}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-[#4338ca] transition-all disabled:opacity-50"
                          >
                            {isProcessingGoal ? (
                              <>
                                <Loader2 className="animate-spin" size={16} />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-sm">check</span>
                                <span>Confirm</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={editGoal}
                            disabled={isProcessingGoal}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-[#121217] dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </main>
          </ErrorBoundary>

          <div className="p-4 lg:p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#121217]">
            {selectedGoalData && (
              <div className="mb-3 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">track_changes</span>
                  <span className="text-sm font-medium text-[#121217] dark:text-white">{selectedGoalData.title}</span>
                </div>
                <button onClick={() => setSelectedGoal(null)} className="text-gray-400 hover:text-gray-600">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}

            {/* <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-3">
              {quickReplies.map((reply) => (
                <button
                  key={reply.id}
                  onClick={() => sendMessage(reply.text)}
                  disabled={isSending}
                  className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-xl bg-primary/10 border border-primary/20 px-4 hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  <p className="text-primary dark:text-indigo-300 text-sm font-semibold">{reply.text}</p>
                </button>
              ))}
            </div> */}
            <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
              <button className="text-[#686586] dark:text-gray-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-2xl">add_circle</span>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Message Coach Aura..."
                className="flex-1 bg-transparent border-none outline-none ring-0 text-base py-2 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-[#121217] dark:text-white"
                disabled={isSending}
              />
              <div className="flex items-center gap-2">
                <button className="text-[#686586] dark:text-gray-400 hover:text-primary transition-colors p-2">
                  <span className="material-symbols-outlined">mic</span>
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={isSending || !input.trim()}
                  className="bg-primary text-white p-2.5 rounded-xl flex items-center justify-center shadow-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <span className="material-symbols-outlined">send</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-background-dark/90 backdrop-blur-xl border-t border-black/5 dark:border-white/10 px-6 py-3 pb-8 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <Link href="/" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="material-symbols-outlined">home</span>
            <span className="text-[10px] font-bold">Home</span>
          </Link>
          <Link href="/chat" className="flex flex-col items-center gap-1 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
            <span className="text-[10px] font-bold">Pulse AI</span>
          </Link>
          <Link href="/goals" className="flex flex-col items-center gap-1 text-gray-400">
            <div className="size-6 bg-primary rounded-full flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-sm">add</span>
            </div>
            <span className="text-[10px] font-bold">Action</span>
          </Link>
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
