export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface HistorySession {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}
