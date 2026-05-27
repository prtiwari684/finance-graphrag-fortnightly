'use client';
import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  cypher?: string;
  recordCount?: number;
}

const SUGGESTIONS = [
  'Which stocks are shared between HDFC and Axis?',
  'Top 5 sectors by combined allocation?',
  'Funds with highest IT sector exposure?',
  'What does SBI Fund hold?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [openCyphers, setOpenCyphers] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleCypher = (index: number) => {
    setOpenCyphers(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer ?? data.error,
        cypher: data.cypher,
        recordCount: data.recordCount,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Request failed. Check your API route.' }]);
    } finally {
      setLoading(false);
    }
  };
  function formatAnswer(text: string): React.ReactNode {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map((line, i) => {
    const isBullet = /^[\*\-]\s+/.test(line.trim());
    const content = line.replace(/^[\*\-]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1');
    if (isBullet) return (
      <div key={i} className="flex items-start gap-2 py-0.5">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span>{content}</span>
      </div>
    );
    return <p key={i} className={i > 0 ? 'mt-2' : ''}>{content}</p>;
  });
}


  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 backdrop-blur shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
            <line x1="7" y1="11.5" x2="17" y2="6.5"/><line x1="7" y1="12.5" x2="17" y2="17.5"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 leading-none">Finance GraphRAG</p>
          <p className="text-xs text-slate-400 mt-0.5">Gemma 4 · Neo4j Aura · Indian Mutual Funds</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400">Live</span>
        </div>
      </header>

      {/* ── Messages ── */}
      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div className="max-w-3xl mx-auto w-full space-y-5">

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-20 pb-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-300 mb-1.5">No queries yet</p>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-6">
                Ask about portfolio overlaps, sector concentrations, or fund-level allocations.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:border-emerald-600 hover:text-emerald-400 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-sm'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-100 rounded-bl-sm'
              }`}>
                {formatAnswer(msg.content)}
              </div>

              {/* Cypher trace */}
              {msg.cypher && (
                <div className="mt-2 max-w-[75%] w-full">
                  <button
                    onClick={() => toggleCypher(i)}
                    className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition"
                  >
                    <svg className={`w-3 h-3 transition-transform ${openCyphers.has(i) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    <span>Cypher query trace</span>
                    {msg.recordCount !== undefined && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400">
                        {msg.recordCount} records
                      </span>
                    )}
                  </button>
                  {openCyphers.has(i) && (
                    <pre className="mt-2 p-3 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 font-mono text-[11px] overflow-x-auto leading-relaxed">
                      {msg.cypher}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-bl-sm bg-slate-800/80 border border-slate-700/60">
                {[0, 150, 300].map(d => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
                <span className="text-xs text-slate-400 font-mono ml-1">Traversing graph nodes…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Input Footer ── */}
      <footer className="shrink-0 border-t border-slate-800 bg-slate-900/40 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2.5 items-end">
          <textarea
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Query fund overlaps, sector allocations…"
            disabled={loading}
            className="flex-1 resize-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600 transition min-h-[42px] leading-relaxed disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
            </svg>
            Execute
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-600 mt-2">
          Shift+Enter for new line · Zero-hallucination mode · Powered by Gemma 4 & Neo4j
        </p>
      </footer>

    </div>
  );
}