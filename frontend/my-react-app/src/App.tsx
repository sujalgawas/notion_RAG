import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
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
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
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

  const clearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      setChatHistory([]);
      setIsMenuOpen(false);
    }
  };

  const exportChat = () => {
    if (chatHistory.length === 0) return;
    const textData = chatHistory.map(m => `${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n');
    const blob = new Blob([textData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-export.txt';
    a.click();
    URL.revokeObjectURL(url);
    setIsMenuOpen(false);
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --primary: #5A56DB;
          --primary-hover: #4844B5;
          --bg-main: #FDFDFD;
          --bg-user: #5A56DB;
          --bg-bot: #F4F4F5;
          --text-main: #1C1C1E;
          --text-muted: #8E8E93;
          --border: #E5E5EA;
        }
        body { 
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; 
          background: var(--bg-main); 
          color: var(--text-main); 
          overflow: hidden; 
        }

        .app { display: flex; height: 100vh; position: relative; width: 100%; transition: all 0.3s ease; }

        /* Main Context */
        .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg-main); position: relative; z-index: 1; }

        .topbar { 
          padding: 16px 28px; 
          border-bottom: 1px solid var(--border); 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          flex-shrink: 0; 
          background: rgba(253, 253, 253, 0.85); 
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .topbar-left { display: flex; align-items: center; gap: 12px; }
        .logo-mark { width: 32px; height: 32px; background: linear-gradient(135deg, #7F77DD 0%, #534AB7 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; font-weight: 700; box-shadow: 0 4px 10px rgba(83, 74, 183, 0.2); }
        .topbar-title { font-size: 18px; font-weight: 600; color: var(--text-main); letter-spacing: -0.3px; }

        .hamburger-btn { 
          background: transparent; 
          border: none; 
          cursor: pointer; 
          width: 40px; 
          height: 40px; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          transition: all 0.2s ease;
          color: var(--text-main);
        }
        .hamburger-btn:hover { background: rgba(0,0,0,0.04); transform: scale(1.05); }

        /* Overlay & Drawer Menu */
        .overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.2);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 40;
          opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
        }
        .overlay.open { opacity: 1; pointer-events: auto; }
        
        .drawer {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 300px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: -5px 0 25px rgba(0,0,0,0.05);
          z-index: 50;
          padding: 24px;
          display: flex; flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .drawer.open { transform: translateX(0); }

        .drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .drawer-title { font-size: 16px; font-weight: 600; }
        .close-btn { background: #F4F4F5; border: none; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; color: var(--text-main); }
        .close-btn:hover { background: #E5E5EA; }

        .menu-section { margin-bottom: 24px; }
        .menu-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        
        .workspace-card {
          background: var(--bg-bot);
          padding: 12px 14px; border-radius: 10px;
          display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500;
        }
        .workspace-icon { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); }

        .menu-btn {
          width: 100%; padding: 12px 14px; border-radius: 10px; background: transparent; border: 1px solid transparent; text-align: left; font-size: 14px; font-weight: 500; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s;
        }
        .menu-btn:hover { background: var(--bg-bot); }
        .menu-btn.primary { background: var(--primary); color: #fff; justify-content: center; margin-top: 8px; }
        .menu-btn.primary:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(90, 86, 219, 0.2); }
        .menu-btn.primary:disabled { opacity: 0.7; cursor: not-allowed; }
        .menu-btn.danger { color: #DC2626; }
        .menu-btn.danger:hover:not(:disabled) { background: #FEF2F2; }
        .menu-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .sync-status { font-size: 13px; text-align: center; margin-top: 10px; font-weight: 500; }

        /* Chat Area */
        .chat-scroll { flex: 1; overflow-y: auto; padding: 40px 10%; display: flex; flex-direction: column; gap: 32px; scroll-behavior: smooth; }
        .chat-scroll::-webkit-scrollbar { width: 8px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #d1d1d6; border-radius: 4px; }
        
        .empty-state { margin: auto; text-align: center; max-width: 400px; padding-bottom: 60px; animation: fadeIn 0.6s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .empty-icon { width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg, #F4F4F5 0%, #E5E5EA 100%); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 8px 16px rgba(0,0,0,0.03); }
        .empty-title { font-size: 22px; font-weight: 700; color: var(--text-main); margin-bottom: 12px; letter-spacing: -0.4px; }
        .empty-sub { font-size: 15px; color: var(--text-muted); line-height: 1.6; }

        .msg-row { display: flex; gap: 16px; align-items: flex-end; animation: slideUp 0.4s ease-out forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .msg-row.user { flex-direction: row-reverse; align-self: flex-end; max-width: 80%; }
        .msg-row.bot { align-self: flex-start; max-width: 85%; align-items: flex-start; }
        
        .avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; }
        .avatar.bot { background: linear-gradient(135deg, #7F77DD 0%, #5A56DB 100%); color: #fff; box-shadow: 0 4px 10px rgba(90, 86, 219, 0.2); }
        .avatar.user { background: var(--bg-main); color: var(--text-muted); border: 2px solid var(--border); }
        
        .bubble { padding: 16px 20px; font-size: 15px; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
        .bubble.bot { background: var(--bg-main); border: 1px solid var(--border); border-radius: 4px 16px 16px 16px; color: var(--text-main); max-width: 100%; overflow-x: auto; }
        .bubble.user { background: var(--bg-user); color: #fff; border-radius: 16px 4px 16px 16px; }
        
        .bubble.bot .markdown-body p { margin-bottom: 12px; }
        .bubble.bot .markdown-body p:last-child { margin-bottom: 0; }
        .bubble.bot .markdown-body ul, .bubble.bot .markdown-body ol { padding-left: 24px; margin-bottom: 12px; }
        .bubble.bot .markdown-body li { margin-bottom: 6px; }
        .bubble.bot .markdown-body code { background: rgba(0,0,0,0.05); color: #DC2626; padding: 2px 6px; border-radius: 4px; font-size: 13.5px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
        .bubble.bot .markdown-body pre { background: var(--text-main); color: #fff; padding: 14px; border-radius: 10px; overflow-x: auto; margin-bottom: 12px; }
        .bubble.bot .markdown-body pre code { background: none; color: inherit; padding: 0; }
        .bubble.bot .markdown-body strong { font-weight: 600; color: #000; }
        
        .sources-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--text-muted); padding: 6px 12px; border-radius: 20px; background: var(--bg-bot); margin-top: 8px; margin-left: 48px; border: 1px solid var(--border); transition: all 0.2s; cursor: default; }
        .sources-pill:hover { background: #E5E5EA; color: var(--text-main); }
        
        .thinking { display: flex; gap: 6px; align-items: center; padding: 16px 20px; background: var(--bg-main); border: 1px solid var(--border); border-radius: 4px 16px 16px 16px; }
        .thinking span { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); animation: pulse 1.4s infinite ease-in-out both; }
        .thinking span:nth-child(1) { animation-delay: -0.32s; }
        .thinking span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes pulse { 0%, 80%, 100% { transform: scale(0); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }

        /* Input Area */
        .input-area { padding: 0 10% 40px; background: linear-gradient(to bottom, rgba(253,253,253,0), rgba(253,253,253,1) 20%); flex-shrink: 0; position: relative; z-index: 10; }
        .input-box { display: flex; align-items: flex-end; gap: 12px; background: #fff; border: 1px solid #D1D1D6; border-radius: 16px; padding: 12px 14px 12px 20px; transition: all 0.2s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
        .input-box:focus-within { border-color: var(--primary); box-shadow: 0 6px 24px rgba(90, 86, 219, 0.15); transform: translateY(-1px); }
        .input-box textarea { flex: 1; background: transparent; border: none; outline: none; resize: none; font-size: 15px; font-family: inherit; color: var(--text-main); line-height: 1.5; min-height: 24px; max-height: 150px; }
        .input-box textarea::placeholder { color: #A1A1AA; }
        
        .send-btn { width: 36px; height: 36px; border-radius: 10px; background: var(--primary); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
        .send-btn:hover:not(:disabled) { background: var(--primary-hover); transform: scale(1.05); }
        .send-btn:disabled { background: var(--bg-bot); cursor: not-allowed; opacity: 0.6; }
        .send-btn:disabled .send-icon { stroke: #A1A1AA; }
        .send-icon { width: 16px; height: 16px; fill: none; stroke: #fff; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; transition: stroke 0.2s; }

        /* Responsive Mobile Behavior */
        @media (max-width: 800px) {
          .chat-scroll { padding: 24px 20px 16px; }
          .input-area { padding: 0 20px 24px; }
          .msg-row.user { max-width: 90%; }
          .msg-row.bot { max-width: 95%; }
          .drawer { width: 80%; max-width: 300px; }
        }
      `}</style>

      <div className="app">
        {/* Overlay for Drawer */}
        <div className={`overlay ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)} />
        
        {/* Right Drawer Menu */}
        <aside className={`drawer ${isMenuOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <span className="drawer-title">Settings</span>
            <button className="close-btn" onClick={() => setIsMenuOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="menu-section">
            <div className="menu-label">Workspace</div>
            <div className="workspace-card">
              <div className="workspace-icon" />
              Notion Database
            </div>
            <button className="menu-btn primary" onClick={handleSync} disabled={isSyncing}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {isSyncing ? 'Syncing Base...' : 'Sync Database'}
            </button>
            {syncMessage && (
              <div className="sync-status" style={{ color: syncOk ? '#059669' : '#DC2626' }}>
                {syncMessage}
              </div>
            )}
          </div>

          <div className="menu-section">
            <div className="menu-label">Chat Options</div>
            <button className="menu-btn" onClick={exportChat} disabled={chatHistory.length === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Export Chat Log
            </button>
            <button className="menu-btn danger" onClick={clearChat} disabled={chatHistory.length === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Clear Chat History
            </button>
          </div>
          
          <div style={{ marginTop: 'auto', fontSize: '12px', color: '#8E8E93', textAlign: 'center' }}>
             Notion RAG v1.0
          </div>
        </aside>

        {/* Main Interface */}
        <div className="main">
          <div className="topbar">
            <div className="topbar-left">
              <div className="logo-mark">N</div>
              <span className="topbar-title">Notion RAG</span>
            </div>
            <button 
              className="hamburger-btn" 
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="chat-scroll">
            {chatHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="empty-title">Ask your Notion workspace</div>
                <div className="empty-sub">Get instant answers from your meeting notes, project docs, research, and more. Sync your database to get started.</div>
              </div>
            ) : (
              chatHistory.map((msg, i) => (
                <React.Fragment key={i}>
                  <div className={`msg-row ${msg.role}`}>
                    {msg.role === 'bot' && <div className="avatar bot">AI</div>}
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
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {msg.sources.length} document{msg.sources.length !== 1 ? 's' : ''} retrieved
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
            <div ref={messagesEndRef} style={{ height: 1 }} />
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