'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Bot, MessageSquare, Moon, Pencil, Search, Send, Trash2, User, X, Sun } from 'lucide-react';
import { HistorySession, Message } from '@/types';

const initialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
};

export default function Home() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activePanel, setActivePanel] = useState<'chat' | 'history'>('chat');
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sessionsList, setSessionsList] = useState<HistorySession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    const container = chatContainerRef.current;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages, activePanel]);

  const sessionEmail = session?.user?.email;
  const isAuthenticated = Boolean(sessionEmail);

  const loadSessions = async () => {
    if (!isAuthenticated || !sessionEmail) {
      setSessionsList([]);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/history?email=${encodeURIComponent(sessionEmail)}`);
      if (!response.ok) throw new Error('Unable to load chat sessions.');
      const data = await response.json();
      const sessions = Array.isArray(data.history)
        ? data.history.map((item: any) => ({
            id: item.chat_id,
            title: item.title || 'Untitled Chat',
            created_at: item.created_at,
            updated_at: item.updated_at,
          }))
        : [];
      setSessionsList(sessions);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [isAuthenticated, sessionEmail]);

  const sidebarUserSection = useMemo(() => {
    if (!isAuthenticated) {
      return (
        <button
          onClick={() => signIn('google')}
          className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors duration-200"
        >
          Login with Google
        </button>
      );
    }

    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm transition-colors duration-200 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <img
            src={session?.user?.image || ''}
            alt={session?.user?.name || 'User avatar'}
            className="h-10 w-10 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{session?.user?.name || 'Signed in'}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{sessionEmail}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 transition-colors duration-200"
        >
          Logout
        </button>
      </div>
    );
  }, [isAuthenticated, session?.user?.image, session?.user?.name, sessionEmail]);

  const filteredSessions = sessionsList.filter((sessionItem) =>
    sessionItem.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setError(null);
    setHistoryMessage(null);
    setActivePanel('chat');
  };

  const handleSubmit = async (event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLTextAreaElement>) => {
    event?.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const previousMessages = messages;
    const userMessage: Message = { role: 'user', content: trimmedInput };

    setError(null);
    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: previousMessages,
          user_email: sessionEmail || null,
          chat_id: activeChatId || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'The assistant could not respond right now.');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || 'Sorry, I could not generate a response.',
      };

      setMessages((prev: Message[]) => [...prev, assistantMessage]);
      if (data.chat_id) {
        setActiveChatId(data.chat_id);
        setSessionsList((prev) => {
          const existing = prev.find((sessionItem) => sessionItem.id === data.chat_id);
          if (existing) {
            return prev.map((sessionItem) => (sessionItem.id === data.chat_id ? { ...sessionItem, title: data.title || sessionItem.title } : sessionItem));
          }
          return [{ id: data.chat_id, title: data.title || 'Untitled Chat' }, ...prev];
        });
      }
      setActivePanel('chat');
      setHistoryMessage(null);
      if (isAuthenticated) {
        await loadSessions();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach the server. Please ensure the backend is running.';
      setError(message);
      setMessages((prev: Message[]) => [...prev, { role: 'assistant', content: 'Sorry, I hit a problem. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setInput('');
    setError(null);
    setHistoryMessage(null);
    setActivePanel('chat');
  };

  const handleSelectSession = async (chatId: string) => {
    setActiveChatId(chatId);
    setMessages([]);
    setInput('');
    setError(null);
    setHistoryMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/history/session?email=${encodeURIComponent(sessionEmail!)}&chat_id=${encodeURIComponent(chatId)}`);
      if (!response.ok) throw new Error('Unable to open that chat session.');
      const data = await response.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setActivePanel('chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open that chat session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (chatId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!sessionEmail) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/history/session?email=${encodeURIComponent(sessionEmail)}&chat_id=${encodeURIComponent(chatId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Unable to delete that chat session.');
      setSessionsList((prev) => prev.filter((item) => item.id !== chatId));
      if (activeChatId === chatId) {
        handleNewChat();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete that chat session.');
    }
  };

  const handleRenameSession = async (chatId: string) => {
    if (!sessionEmail) return;
    const currentSession = sessionsList.find((item) => item.id === chatId);
    const nextTitle = window.prompt('Rename conversation', currentSession?.title || 'Untitled Chat');
    if (!nextTitle?.trim()) return;

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/history/session/rename?email=${encodeURIComponent(sessionEmail)}&chat_id=${encodeURIComponent(chatId)}&title=${encodeURIComponent(nextTitle.trim())}`,
        { method: 'PATCH' },
      );
      if (!response.ok) throw new Error('Unable to rename that chat session.');
      setSessionsList((prev) => prev.map((item) => (item.id === chatId ? { ...item, title: nextTitle.trim() } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rename that chat session.');
    }
  };

  const handleHistoryClick = async () => {
    if (!isAuthenticated) {
      setHistoryMessage('Please sign in to view and save your chat history.');
      return;
    }

    try {
      setError(null);
      setHistoryMessage(null);
      setIsLoading(true);
      await loadSessions();
      setActivePanel('history');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch history.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  const settingsPanel = showSettings ? (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm transition-colors duration-200 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Theme</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Toggle light and dark mode.</p>
        </div>
        <button
          onClick={handleToggleTheme}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700 shadow-sm transition-colors duration-200 hover:bg-neutral-50 dark:border-slate-700 dark:bg-slate-800 dark:text-neutral-100 dark:hover:bg-slate-700"
        >
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900 transition-colors duration-300 dark:bg-slate-950 dark:text-neutral-100">
      <aside className="hidden md:flex flex-col w-80 bg-white border-r border-neutral-100 p-6 shadow-sm transition-colors duration-300 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Bot className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Groq AI</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Multi-session workspace</p>
          </div>
        </div>

        <button
          onClick={handleNewChat}
          className="mb-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-amber-600"
        >
          <span className="text-lg">+</span>
          <span>New Chat</span>
        </button>

        {isAuthenticated && (
          <label className="mb-4 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-neutral-400">
            <Search className="h-4 w-4" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search history"
              className="w-full border-none bg-transparent outline-none"
            />
          </label>
        )}

        <div className="flex-1 overflow-y-auto pr-1">
          {isAuthenticated ? (
            filteredSessions.length > 0 ? (
              <div className="space-y-2">
                {filteredSessions.map((sessionItem) => (
                  <div
                    key={sessionItem.id}
                    className={`group flex items-center gap-2 rounded-2xl border px-3 py-3 transition-colors duration-200 ${
                      activeChatId === sessionItem.id
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950'
                        : 'border-transparent hover:bg-neutral-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <button
                      onClick={() => void handleSelectSession(sessionItem.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <MessageSquare className="h-4 w-4 text-amber-500" />
                      <span className="flex-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{sessionItem.title}</span>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <button
                        onClick={() => void handleRenameSession(sessionItem.id)}
                        className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-slate-700 dark:hover:text-neutral-100"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(event) => void handleDeleteSession(sessionItem.id, event)}
                        className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-slate-700 dark:hover:text-neutral-100"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500 dark:border-slate-700 dark:text-neutral-400">
                No saved sessions yet.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500 dark:border-slate-700 dark:text-neutral-400">
              Sign in to start saving conversations.
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {sidebarUserSection}
          {settingsPanel}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-neutral-100 px-6 py-4 shadow-sm transition-colors duration-300 dark:bg-slate-950 dark:border-slate-800">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center md:hidden">
                <Bot className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Groq AI Assistant</h2>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleClearChat}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors duration-200 dark:text-neutral-300 dark:hover:bg-slate-800"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 border-b border-red-100 px-6 py-3 transition-colors duration-200 dark:bg-rose-950 dark:border-rose-900">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 transition-colors duration-200 dark:text-red-200 dark:hover:text-red-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6 transition-colors duration-300 dark:bg-slate-950">
          <div className="max-w-6xl mx-auto space-y-4">
            {historyMessage && (
              <div className="rounded-3xl border border-amber-100 bg-amber-50 px-6 py-5 text-sm text-amber-800 shadow-sm transition-colors duration-200 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                {historyMessage}
              </div>
            )}
            {messages.length === 0 && !historyMessage && (
              <div className="text-center py-12">
                <Bot className="w-16 h-16 mx-auto text-neutral-300 dark:text-neutral-500 mb-4" />
                <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-100 mb-2">Start a conversation</h3>
                <p className="text-neutral-500 dark:text-neutral-400">Ask me anything and I will do my best to help.</p>
              </div>
            )}

            {messages.map((message: Message, index: number) => (
              <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-amber-600" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm transition-colors duration-200 ${
                    message.role === 'user'
                      ? 'bg-neutral-200 text-neutral-800 rounded-br-md dark:bg-slate-800 dark:text-neutral-100'
                      : 'bg-amber-50 text-neutral-800 rounded-bl-md border border-amber-100 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-100'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 dark:bg-slate-800">
                    <User className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-amber-600" />
                </div>
                <div className="rounded-2xl rounded-bl-md border border-amber-100 bg-amber-50 px-5 py-3 shadow-sm dark:border-amber-700 dark:bg-amber-950">
                  <div className="mb-2 text-sm text-amber-800 dark:text-amber-200">AI is typing...</div>
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="bg-white border-t border-neutral-100 p-4 shadow-sm transition-colors duration-300 dark:bg-slate-950 dark:border-slate-800">
          <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">
            <div className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    void handleSubmit(event);
                  }
                }}
                placeholder="Type your message..."
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:border-slate-700 dark:bg-slate-900 dark:text-neutral-100 dark:placeholder-slate-500"
                style={{ minHeight: '48px', maxHeight: '200px' }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-6 py-3 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </footer>
      </main>
    </div>
  );
}
