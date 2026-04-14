import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  sources?: any[];
}

function App() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncOk, setSyncOk] = useState(true);
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const API_BASE_URL = 'http://localhost:8000';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing...');
    try {
      const response = await fetch(`${API_BASE_URL}/build_rag`);
      const data = await response.json();
      setSyncOk(response.ok);
      setSyncMessage(response.ok ? `✓ ${data.message}` : `✗ ${data.detail || 'Failed to sync'}`);
    } catch {
      setSyncOk(false);
      setSyncMessage('✗ Backend unreachable');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 5000);
    }
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    const userMessage = query.trim();
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setQuery('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsChatLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage }),
      });
      const data = await response.json();
      setChatHistory(prev => [
        ...prev,
        {
          role: 'bot',
          content: response.ok ? data.response : `Error: ${data.detail || 'Something went wrong.'}`,
          sources: response.ok ? data.retrieved_docs : undefined,
        },
      ]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'bot', content: 'Network error: could not reach the chatbot API.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  const userCount = chatHistory.filter(m => m.role === 'user').length;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background: #f6f5f4; color: #37352f; }

        .app { display: flex; height: 100vh; }

        /* Sidebar */
        .sidebar { width: 240px; background: #fbfaf9; border-right: 1px solid #ebebea; display: flex; flex-direction: column; padding: 20px 14px; gap: 2px; flex-shrink: 0; }
        .sidebar-logo { display: flex; align-items: center; gap: 10px; padding: 6px 6px 18px; border-bottom: 1px solid #ebebea; margin-bottom: 10px; }
        .logo-mark { width: 28px; height: 28px; background: #7F77DD; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #eeedfe; font-size: 13px; font-weight: 600; flex-shrink: 0; }
        .logo-text { font-size: 14px; font-weight: 600; color: #37352f; }
        .sidebar-section-label { font-size: 11px; font-weight: 600; color: #9b9a97; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 6px 4px; }
        .nav-item { display: flex; align-items: center; gap: 9px; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; color: #787774; transition: background 0.12s, color 0.12s; }
        .nav-item:hover { background: #f0efee; color: #37352f; }
        .nav-item.active { background: #eeedfe; color: #534AB7; font-weight: 500; }
        .nav-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .sidebar-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid #ebebea; }
        .sync-btn { width: 100%; padding: 8px 12px; border-radius: 6px; background: #7F77DD; border: none; color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; transition: background 0.15s; }
        .sync-btn:hover:not(:disabled) { background: #534AB7; }
        .sync-btn:disabled { background: #ebebea; color: #9b9a97; cursor: not-allowed; }
        .sync-status { font-size: 12px; text-align: center; margin-top: 8px; min-height: 16px; }

        /* Main */
        .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #fff; }
        .topbar { padding: 14px 28px; border-bottom: 1px solid #ebebea; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .topbar-title { font-size: 15px; font-weight: 600; color: #37352f; }
        .topbar-meta { font-size: 12px; color: #9b9a97; }

        /* Chat */
        .chat-scroll { flex: 1; overflow-y: auto; padding: 32px 28px 16px; display: flex; flex-direction: column; gap: 24px; }
        .chat-scroll::-webkit-scrollbar { width: 6px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #e3e2df; border-radius: 3px; }
        .empty-state { margin: auto; text-align: center; max-width: 320px; padding-bottom: 40px; }
        .empty-icon { width: 52px; height: 52px; border-radius: 14px; background: #eeedfe; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; }
        .empty-title { font-size: 17px; font-weight: 600; color: #37352f; margin-bottom: 8px; }
        .empty-sub { font-size: 14px; color: #787774; line-height: 1.65; }

        .msg-row { display: flex; gap: 12px; align-items: flex-start; }
        .msg-row.user { flex-direction: row-reverse; align-self: flex-end; max-width: 78%; }
        .msg-row.bot { align-self: flex-start; max-width: 85%; }
        .avatar { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; margin-top: 2px; }
        .avatar.bot { background: #eeedfe; color: #534AB7; }
        .avatar.user { background: #f0efee; color: #787774; border: 1px solid #e3e2df; }
        .bubble { padding: 12px 16px; font-size: 14px; line-height: 1.7; }
        .bubble.bot { background: #f9f9f8; border: 1px solid #ebebea; border-radius: 4px 12px 12px 12px; color: #37352f; }
        .bubble.user { background: #7F77DD; color: #fff; border-radius: 12px 4px 12px 12px; }
        .bubble.bot .markdown-body p { margin-bottom: 10px; }
        .bubble.bot .markdown-body p:last-child { margin-bottom: 0; }
        .bubble.bot .markdown-body ul, .bubble.bot .markdown-body ol { padding-left: 20px; margin-bottom: 10px; }
        .bubble.bot .markdown-body li { margin-bottom: 4px; }
        .bubble.bot .markdown-body code { background: #ebebea; color: #d44; padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: monospace; }
        .bubble.bot .markdown-body strong { font-weight: 600; }
        .sources-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #9b9a97; padding: 3px 10px; border-radius: 20px; background: #f0efee; margin-top: 6px; margin-left: 40px; border: 1px solid #ebebea; }
        .thinking { display: flex; gap: 5px; align-items: center; padding: 14px 16px; background: #f9f9f8; border: 1px solid #ebebea; border-radius: 4px 12px 12px 12px; }
        .thinking span { width: 6px; height: 6px; border-radius: 50%; background: #AFA9EC; animation: bounce 1.2s infinite; }
        .thinking span:nth-child(2) { animation-delay: 0.15s; }
        .thinking span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce { 0%,60%,100% { transform: translateY(0); opacity: 0.6; } 30% { transform: translateY(-5px); opacity: 1; } }

        /* Input */
        .input-area { padding: 14px 28px 22px; background: #fff; border-top: 1px solid #ebebea; flex-shrink: 0; }
        .input-box { display: flex; align-items: flex-end; gap: 10px; background: #f9f9f8; border: 1px solid #e3e2df; border-radius: 10px; padding: 10px 10px 10px 16px; transition: border-color 0.15s; }
        .input-box:focus-within { border-color: #7F77DD; box-shadow: 0 0 0 3px rgba(127,119,221,0.12); }
        .input-box textarea { flex: 1; background: transparent; border: none; outline: none; resize: none; font-size: 14px; font-family: inherit; color: #37352f; line-height: 1.5; min-height: 22px; max-height: 120px; }
        .input-box textarea::placeholder { color: #9b9a97; }
        .send-btn { width: 32px; height: 32px; border-radius: 7px; background: #7F77DD; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s; }
        .send-btn:hover:not(:disabled) { background: #534AB7; }
        .send-btn:disabled { background: #e3e2df; cursor: not-allowed; }
        .send-icon { width: 14px; height: 14px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      `}</style>

      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">N</div>
            <span className="logo-text">Notion RAG</span>
          </div>
          <div className="sidebar-section-label">Workspaces</div>
          <div className="nav-item active">
            <div className="nav-dot" style={{ background: '#7F77DD' }} />
            My Workspace
          </div>

          <div className="sidebar-footer">
            <button className="sync-btn" onClick={handleSync} disabled={isSyncing}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {isSyncing ? 'Syncing...' : 'Sync database'}
            </button>
            {syncMessage && (
              <div className="sync-status" style={{ color: syncOk ? '#0F6E56' : '#993C1D' }}>
                {syncMessage}
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="main">
          <div className="topbar">
            <span className="topbar-title">Assistant</span>
            <span className="topbar-meta">{userCount} {userCount === 1 ? 'message' : 'messages'}</span>
          </div>

          <div className="chat-scroll">
            {chatHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="empty-title">Ask your Notion workspace</div>
                <div className="empty-sub">Sync your database first, then ask anything — meeting notes, project docs, research, and more.</div>
              </div>
            ) : (
              chatHistory.map((msg, i) => (
                <React.Fragment key={i}>
                  <div className={`msg-row ${msg.role}`}>
                    <div className={`avatar ${msg.role}`}>{msg.role === 'bot' ? 'AI' : 'You'}</div>
                    <div className={`bubble ${msg.role}`}>
                      {msg.role === 'user' ? (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                      ) : (
                        <div className="markdown-body">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="sources-pill">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {msg.sources.length} source chunks
                    </div>
                  )}
                </React.Fragment>
              ))
            )}

            {isChatLoading && (
              <div className="msg-row bot">
                <div className="avatar bot">AI</div>
                <div className="thinking">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <div className="input-box">
              <textarea
                ref={textareaRef}
                value={query}
                onChange={e => { setQuery(e.target.value); autoResize(); }}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your workspace…"
                disabled={isChatLoading}
                rows={1}
              />
              <button
                className="send-btn"
                onClick={() => handleChatSubmit()}
                disabled={isChatLoading || !query.trim()}
              >
                <svg className="send-icon" viewBox="0 0 24 24">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;