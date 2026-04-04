"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, LogOut, Shield, Sparkles, X, SlidersVertical, Send } from 'lucide-react';

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

interface User {
  name?: string;
  picture?: string;
  email?: string;
  nickname?: string;
}

const DECISION_COLORS = {
  allow: {
    bg: "rgba(16,185,129,0.1)",
    text: "#10b981",
    border: "rgba(16,185,129,0.2)",
    dot: "#10b981",
  },
  block: {
    bg: "rgba(239,68,68,0.1)",
    text: "#ef4444",
    border: "rgba(239,68,68,0.2)",
    dot: "#ef4444",
  },
  "step-up": {
    bg: "rgba(245,158,11,0.1)",
    text: "#f59e0b",
    border: "rgba(245,158,11,0.2)",
    dot: "#f59e0b",
  },
} as const;

export default function ChatUI({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sheetTab, setSheetTab] = useState<"policies" | "audit">("policies");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  const decisionColor = (d: string) => DECISION_COLORS[d as keyof typeof DECISION_COLORS] ?? {
    bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.1)", dot: "rgba(255,255,255,0.4)"
  };

  return (
    <div 
    className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header
      className="w-full relative z-999 bg-background flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <div
        className="flex items-center gap-2.5 pointer-events-none" ><Shield size={28}/>
          <div className="leading-tighter">
            <div className="text-sm font-bold tracking-tight">Guardian</div>
            <div
            className="text-[10px] text-foreground/50 tracking-wide uppercase font-medium">AI Agent Firewall</div>
          </div>
        </div>

        {/* Right — user avatar + dropdown */}
        <div
        className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-foreground/5 rounded-full px-2 py-1.5">
            {user.picture ? (
              <img src={user.picture} alt="user profile"
              className="w-7 h-7 rounded-full object-cover"/>
            ) : (
              <div
              className="w-7 h-7 rounded-full flex items-center justify-center-safe text-xs"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                {user.name?.[0] ?? "U"}
              </div>
            )}
            <span
            className="text-xs font-medium">
              {user.nickname ?? user.name?.split(" ")[0] ?? "User"}
            </span>
            <ChevronDown size={16} className="text-foreground/50"/>
          </button>

          {showDropdown && (
            <>
              <div
              className="fixed inset-0 z-999" 
              onClick={() => setShowDropdown(false)} />
              <div 
              className="absolute top-12 right-0 w-50 z-40 border border-foreground/10 rounded-xl bg-background backdrop-blur-md overflow-hidden p-3 shadow-xl">
                {/* User info */}
                <div
                className="border-b border-foreground/10 pb-1.5"> 
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-[11px] text-foreground/50 mt-1">{user.email ?? user.nickname}</div>
                </div>

                <div>
                  <div
                   className="flex items-center gap-2 rounded-full text-xs my-3">
                    <span style={{
                      display: "inline-flex", width: 6, height: 6,
                      borderRadius: "50%", background: "#10b981",
                    }} />
                    Firewall Active
                  </div>
                </div>

                <div 
                className="pt-1.5 border-t border-foreground/10"
                >
                  <a
                    href="/auth/logout"
                    className="flex items-center gap-2 py-2 px-2.5 rounded-full border border-foreground/10 text-xs hover:bg-foreground/5 transition-colors">
                    <LogOut size={12} />
                    Sign out
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── CHAT AREA ── */}
      <main className="relative flex-1 overflow-y-auto">
  <div className="relative max-w-180 my-0 mx-auto">
    
    {/* TOP FADE */}
    <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 z-10 bg-linear-to-b from-background via-background/80 to-transparent" />

    {/* BOTTOM FADE */}
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 z-10 bg-linear-to-t from-background via-background/80 to-transparent" />

    {/* SCROLL AREA */}
    <div className="p-4 max-h-[70vh] overflow-y-auto">
      
      {messages.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-16 h-16 mb-5 mx-auto flex items-center justify-center">
            <Shield className="w-15 h-15" strokeWidth={1.5} />
          </div>

          <h1 className="font-medium text-xl mb-3 text-foreground/70">
            What can I help with?
          </h1>

          <p className="text-sm text-foreground/50 max-w-2xl mx-auto mb-6 leading-tight">
            Every action is intercepted by Guardian and evaluated against your security policies before execution.
          </p>

          <div className="flex flex-wrap gap-2 items-center justify-center">
            {[
              "List my GitHub repositories",
              "Which repos are private?",
              "Show my recent projects",
            ].map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-xs py-1 px-3 rounded-full border border-foreground/20 text-foreground/80 hover:bg-foreground/5 transition-colors cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-foreground/10">
                  <Sparkles size={16} strokeWidth={1.75} />
                </div>
              )}

              <div
                className={`px-3 py-2 max-w-[70%] text-sm leading-snug whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-foreground/10 text-foreground rounded-full"
                    : "text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* LOADING */}
          {loading && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-foreground/10">
                <Sparkles size={16} strokeWidth={1.75} />
              </div>

              <div className="flex gap-1 items-center">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-foreground/20"
                    style={{
                      animation: `bounce 1s ${delay}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  </div>
</main>

      {/* ── SIDE SHEET ── */}
      {showSheet && (
        <>
          <div
          className="fixed inset-0 bg-foreground/10 z-50 backdrop-blur-[3px]"
            onClick={() => setShowSheet(false)}
          />
          <div
          className="fixed top-0 right-0 h-full w-full max-w-200 z-50 bg-background flex flex-col shadow-2xl px-6 py-5">

            {/* Sheet header */}
            <div 
            className="flex items-center justify-between border-b border-foreground/10 pb-3">
              <div className="flex gap-1">
                {([
                  { id: "policies", label: "Policies" },
                  { id: "audit", label: "Audit" },
                ] as const).map(tab => (
                  <button key={tab.id} onClick={() => setSheetTab(tab.id)}
                  className={`text-sm font-medium cursor-pointer transition-all py-1 px-3 rounded-full ${sheetTab === tab.id ? "text-foreground bg-foreground/5" : "text-foreground/50 hover:text-foreground"}`} >{tab.label}</button>
                ))}
              </div>
              <button onClick={() => setShowSheet(false)} 
              className="cursor-pointer text-foreground/50 hover:text-foreground"><X className="w-5 h-5" strokeWidth={2}/></button>
            </div>

            {/* Sheet content */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {/* Policies tab */}
              {sheetTab === "policies" && (
                <div>
                 <p className="text-xs uppercase tracking-wider text-foreground my-4 font-medium">
  Policy Logs
</p>
                 <div className="flex flex-col gap-3">
  {policies.map((policy) => {
    const colors = decisionColor(policy.decision);

    return (
      <div
        key={policy.id}
        className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 transition"
      >
        {/* LEFT */}
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: colors.dot }}
          />

          <div className="flex flex-col text-xs">
            <span className="text-foreground/80 font-medium">
              {policy.provider}
            </span>
            <span className="text-foreground/40">
              {policy.action} / {policy.resource}
            </span>
          </div>
        </div>

        {/* RIGHT (DECISIONS) */}
        <div className="flex gap-2">
          {(["allow", "block", "step-up"] as const).map((d) => {
            const dc = decisionColor(d);
            const active = policy.decision === d;

            return (
              <button
                key={d}
                onClick={() => updateDecision(policy.id, d)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${
                  active
                    ? ""
                    : "border-transparent text-foreground/30 hover:text-foreground/70"
                }`}
                style={
                  active
                    ? {
                        background: dc.bg,
                        borderColor: dc.border,
                        color: dc.text,
                      }
                    : {}
                }
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    );
  })}
</div>

                  <button
  onClick={savePolicies}
  disabled={saving}
  className={`
    w-full mt-5 py-3 rounded-xl text-xs font-medium
    transition-all border cursor-pointer
    ${
      saving
        ? "bg-foreground/5 text-foreground/30 border-foreground/10 cursor-not-allowed"
        : saved
        ? "bg-foreground/10 text-foreground border-foreground/20"
        : "bg-foreground/5 text-foreground/70 border-foreground/10 hover:bg-foreground/10"
    }
  `}
>
  {saving
    ? "Saving..."
    : saved
    ? "saved"
    : "Save changes"}
</button>
                </div>
              )}

              {/* Audit tab */}
              {sheetTab === "audit" && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs uppercase tracking-wider text-foreground mt-4 font-medium">
  Audit Logs
</p>

<p className="text-xs text-foreground/80 mb-4">
  Live activity · updates every 3s
</p>
  {[...auditLog].reverse().map((entry, i) => {
    const colors = decisionColor(entry.decision);

    return (
      <div
        key={i}
        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-foreground/5 bg-white/2 hover:bg-foreground/10 transition"
      >
        {/* DOT */}
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: colors.dot }}
        />

        {/* TIME */}
        <span className="text-xs text-foreground/70 font-mono w-[65px] shrink-0">
          {new Date(entry.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        {/* ACTION */}
        <span className="text-xs font-mono text-foreground font-medium flex-1 truncate">
          {entry.provider}/{entry.action}/{entry.resource}
        </span>

        {/* STATUS */}
        <span
          className="text-xs px-2 py-1 rounded-md font-medium"
          style={{
            color: colors.text,
          }}
        >
          {entry.decision}
        </span>
      </div>
    );
  })}
</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── INPUT ── */}
<div className="relative z-10 max-w-3xl w-full mx-auto px-4 pb-6">
  <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden shadow-md focus-within:ring-4 focus-within:ring-foreground/5">
    
    {/* TEXTAREA */}
    <textarea
      ref={textareaRef}
      value={input}
      onChange={handleTextareaChange}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      }}
      placeholder="Ask the agent something..."
      rows={1}
      className="w-full bg-transparent border-none outline-none resize-none px-4 pt-4 pb-2 text-[15px] text-foreground placeholder:text-foreground/40 leading-relaxed block font-normal"
    />

    {/* BOTTOM BAR */}
    <div className="flex items-center justify-between px-3 pb-3 pt-2">
      
      {/* Left — Policies button */}
      <button
        onClick={() => setShowSheet(!showSheet)}
        className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 border transition-all bg-transparent border-foreground/30 text-foreground/80 hover:border-foreground/10 rounded-full cursor-pointer hover:bg-foreground/5`}
      >
        <SlidersVertical className="w-4 h-4" />
        Policies & Audit
      </button>

      {/* Right — hint + send */}
       <button
  onClick={sendMessage}
  disabled={!input.trim() || loading}
  className={`
    flex items-center justify-center
    w-10 h-10 rounded-full
    border transition-all
    focus:outline-none focus:ring-2 focus:ring-foreground/5

    ${
      input.trim() && !loading
        ? "bg-foreground text-background border-foreground hover:bg-foreground/90 active:scale-[0.97] cursor-pointer"
        : "bg-transparent  text-foreground/80 border-foreground/20 cursor-not-allowed"
    }
  `}
>
  <Sparkles className="w-5 h-5" />
</button>
    </div>
  </div>
</div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}