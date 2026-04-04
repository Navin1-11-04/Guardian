"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PolicyRule {
  id: string;
  provider: string;
  action: string;
  resource: string;
  decision: "allow" | "block" | "step-up";
}

interface AuditEntry {
  provider: string;
  action: string;
  resource: string;
  decision: string;
  timestamp: string;
}

const DECISION_STYLES: Record<string, string> = {
  allow: "bg-green-500 text-white",
  block: "bg-red-500 text-white",
  "step-up": "bg-yellow-500 text-black",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTray, setShowTray] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [trayTab, setTrayTab] = useState<"policies" | "audit">("policies");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/policies").then(r => r.json()).then(d => setPolicies(Array.isArray(d.policies) ? d.policies : []));
    fetch("/api/audit").then(r => r.json()).then(d => setAuditLog(Array.isArray(d.log) ? d.log : []));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/audit").then(r => r.json()).then(d => setAuditLog(Array.isArray(d.log) ? d.log : []));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function updateDecision(id: string, decision: "allow" | "block" | "step-up") {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, decision } : p));
  }

  async function savePolicies() {
    setSaving(true);
    await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policies }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function sendMessage() {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply ?? data.error ?? "No response",
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error contacting agent." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
        {/* Left — dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-2 rounded-lg transition-colors"
          >
            <span className="text-lg">🛡️</span>
            Guardian
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute top-12 left-0 w-52 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden">
              <div className="p-1">
                <a href="/auth/login" className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                  <span>👤</span> Login
                </a>
                <a href="/auth/logout" className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                  <span>🚪</span> Logout
                </a>
                <a href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                  <span>⚙️</span> Full Dashboard
                </a>
              </div>
              <div className="border-t border-zinc-200 dark:border-zinc-700 p-1">
                <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-400">
                  <span>ℹ️</span> AI Agent Firewall
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — status */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
          Guardian Active
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 space-y-6 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center mt-20">
            <div className="text-4xl mb-4">🛡️</div>
            <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
              Guardian — AI Agent Firewall
            </h2>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              Every agent action is intercepted, evaluated against your policies, and logged. Try asking the agent to list your GitHub repositories.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {["List my GitHub repositories", "What repos are private?", "Show my projects"].map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === "user"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-400 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              <span className="animate-pulse delay-75">●</span>
              <span className="animate-pulse delay-150">●</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Policy/Audit Tray */}
     {/* RIGHT SIDE SHEET */}
{showTray && (
  <>
    {/* Overlay */}
    <div
      className="fixed inset-0 bg-black/30 z-40"
      onClick={() => setShowTray(false)}
    />

    {/* Sheet */}
    <div className="fixed top-0 right-0 h-full w-[380px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col animate-slideIn">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2">
          {["policies", "audit"].map(tab => (
            <button
              key={tab}
              onClick={() => setTrayTab(tab as any)}
              className={`text-xs px-3 py-1.5 rounded-full transition ${
                trayTab === tab
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {tab === "policies" ? "Policies" : "Audit"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowTray(false)}
          className="text-zinc-400 hover:text-zinc-600 text-lg"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* Policies */}
        {trayTab === "policies" && (
          <div className="p-4">
            <div className="space-y-2">
              {policies.map(policy => (
                <div key={policy.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <div className="text-xs font-mono text-zinc-500">
                    {policy.provider}/{policy.action}/{policy.resource}
                  </div>
                  <div className="flex gap-1">
                    {(["allow", "block", "step-up"] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => updateDecision(policy.id, d)}
                        className={`px-2 py-0.5 rounded-full text-xs ${DECISION_STYLES[d]} ${
                          policy.decision === d ? "" : "opacity-30"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={savePolicies}
              className="mt-4 w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2 rounded-lg text-xs"
            >
              Save Changes
            </button>
          </div>
        )}

        {/* Audit */}
        {trayTab === "audit" && (
          <div className="p-4 space-y-2">
            {auditLog.map((entry, i) => (
              <div key={i} className="text-xs flex justify-between">
                <span className="text-zinc-400">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-mono">
                  {entry.provider}/{entry.action}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </>
)}

      {/* Input bar */}
      <div className="max-w-3xl w-full mx-auto px-6 pb-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm overflow-hidden">
          <textarea
            className="w-full px-4 pt-4 pb-2 text-sm text-zinc-800 dark:text-zinc-100 bg-transparent resize-none outline-none placeholder-zinc-400 min-h-[60px] max-h-32"
            placeholder="Ask the agent something..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={2}
          />
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-2">
              {/* Tools button */}
              <button
                onClick={() => setShowTray(!showTray)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  showTray
                    ? "border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Policies
              </button>
            </div>

            {/* Send button */}
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-medium px-4 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <span className="text-base leading-none">✦</span>
              <span>Send</span>
              <kbd className="text-[10px] opacity-50 font-mono">↵</kbd>
            </button>
          </div>
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {showDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
      )}
    </div>
  );
}