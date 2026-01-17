// Frontend TypeScript Types

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export type GoalCategory = 'productivity' | 'health' | 'finance' | 'learning' | 'social';
export type GoalStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';

export interface Checkin {
  id: string;
  goalId: string;
  userId: string;
  response: string;
  mood?: 'happy' | 'neutral' | 'struggling' | 'frustrated';
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  userId: string;
  goalId?: string;
}

export interface ChatResponse {
  response: string;
  agent: string;
}
