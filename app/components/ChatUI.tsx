"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  LogOut,
  Shield,
  Sparkles,
  X,
  SlidersVertical,
  ExternalLink,
  Lock,
  Unlock,
  Star,
  Code2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  CircleDot,
  GitBranch,
  Hash,
  ShieldOff,
} from "lucide-react";

// ─────────────────────────────────────────────
// Core types
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Agent response shape types
// ─────────────────────────────────────────────
interface AgentEnvelope {
  ok: boolean;
  count?: number;
  data?: unknown;
  error?: string;
}

interface RepoItem {
  name: string;
  private: boolean;
  url: string;
  language: string | null;
  updated_at: string | null;
  stars: number;
}

interface RepoDetails extends RepoItem {
  owner: string;
  description: string | null;
  open_issues: number;
  default_branch: string;
  forks: number;
  watchers: number;
  created_at: string;
  topics: string[];
  license: string | null;
  recent_issues: Array<{ number: number; title: string; url: string }>;
  branches: string[];
}

interface IssueItem {
  number: number;
  title: string;
  state: string;
  url: string;
  created_at: string;
}

interface CreatedIssue {
  number: number;
  title: string;
  url: string;
  state: string;
}

interface DeleteConfirm {
  confirmation_required: boolean;
  message: string;
  instruction: string;
  repo: string;
}

interface DeleteResult {
  deleted: boolean;
  repo: string;
  message: string;
}

interface ResolvedRepo {
  owner: string;
  repo: string;
  source: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
};

function langColor(lang: string | null) {
  return lang ? (LANG_COLORS[lang] ?? "#8b949e") : "#8b949e";
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// ─────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────
function isRepoArray(data: unknown): data is RepoItem[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof (data[0] as RepoItem).name === "string" &&
    typeof (data[0] as RepoItem).url === "string" &&
    typeof (data[0] as RepoItem).private === "boolean" &&
    !("number" in (data[0] as object))
  );
}

function isIssueArray(data: unknown): data is IssueItem[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof (data[0] as IssueItem).number === "number" &&
    typeof (data[0] as IssueItem).title === "string"
  );
}

function isRepoDetails(data: unknown): data is RepoDetails {
  return (
    !Array.isArray(data) &&
    typeof data === "object" &&
    data !== null &&
    "owner" in data &&
    "default_branch" in data
  );
}

function isCreatedIssue(data: unknown): data is CreatedIssue {
  return (
    !Array.isArray(data) &&
    typeof data === "object" &&
    data !== null &&
    "number" in data &&
    "state" in data &&
    !("confirmation_required" in data)
  );
}

function isDeleteConfirm(data: unknown): data is DeleteConfirm {
  return typeof data === "object" && data !== null && "confirmation_required" in data;
}

function isDeleteResult(data: unknown): data is DeleteResult {
  return typeof data === "object" && data !== null && "deleted" in data;
}

function isResolvedRepo(data: unknown): data is ResolvedRepo {
  return (
    typeof data === "object" &&
    data !== null &&
    "owner" in data &&
    "source" in data &&
    !("default_branch" in data)
  );
}

// Detect the firewall's plain-text "Blocked: ..." string
function isBlockedMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.startsWith("blocked:") ||
    lower.includes("access denied") ||
    lower.includes("not permitted") ||
    lower.includes("security polic")
  );
}

// ─────────────────────────────────────────────
// Card components
// ─────────────────────────────────────────────
function RepoCard({ repo }: { repo: RepoItem }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/5 transition-all group"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {repo.private ? (
          <Lock size={13} className="text-amber-400 mt-0.5 shrink-0" />
        ) : (
          <Unlock size={13} className="text-emerald-400 mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors truncate">
            {repo.name}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {repo.language && (
              <span className="flex items-center gap-1 text-xs text-foreground/50">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: langColor(repo.language) }}
                />
                {repo.language}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-foreground/40">
              <Calendar size={10} />
              {timeAgo(repo.updated_at)}
            </span>
            {repo.stars > 0 && (
              <span className="flex items-center gap-1 text-xs text-foreground/40">
                <Star size={10} />
                {repo.stars}
              </span>
            )}
          </div>
        </div>
      </div>
      <ExternalLink size={13} className="text-foreground/30 shrink-0 mt-0.5" />
    </a>
  );
}
function RepoDetailsCard({ data }: { data: RepoDetails }) {
  return (
    <div className="rounded-xl border border-foreground/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {data.private
            ? <Lock size={13} className="text-amber-400" />
            : <Unlock size={13} className="text-emerald-400" />}
          <span className="font-semibold text-sm">{data.owner}/{data.name}</span>
          {data.license && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-foreground/40 border border-foreground/10">
              {data.license}
            </span>
          )}
        </div>
        <a href={data.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={13} className="text-foreground/40 hover:text-foreground/80" />
        </a>
      </div>

      {/* Description */}
      {data.description && data.description !== "No description" && (
        <div className="px-4 py-2.5 text-xs text-foreground/60 border-b border-foreground/5 leading-relaxed">
          {data.description}
        </div>
      )}

      {/* Topics */}
      {data.topics && data.topics.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-foreground/5">
          {data.topics.map((t: string) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2.5">
        {[
          { icon: <Code2 size={12} />, label: "Language", value: data.language ?? "—" },
          { icon: <GitBranch size={12} />, label: "Default branch", value: data.default_branch },
          { icon: <CircleDot size={12} />, label: "Open issues", value: String(data.open_issues) },
          { icon: <Star size={12} />, label: "Stars", value: String(data.stars) },
          { icon: <Hash size={12} />, label: "Forks", value: String((data as any).forks ?? 0) },
          { icon: <Calendar size={12} />, label: "Last updated", value: timeAgo(data.updated_at) },
          { icon: <Calendar size={12} />, label: "Created", value: timeAgo((data as any).created_at) },
        ].map(({ icon, label, value }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="text-foreground/30">{icon}</span>
            <span className="text-foreground/40">{label}:</span>
            <span className="text-foreground/80 font-medium">{value}</span>
          </div>
        ))}
      </div>

      {/* Branches */}
      {(data as any).branches?.length > 0 && (
        <div className="px-4 py-2.5 border-t border-foreground/5">
          <div className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1.5">Branches</div>
          <div className="flex flex-wrap gap-1.5">
            {(data as any).branches.map((b: string) => (
              <span key={b} className="text-[10px] px-2 py-0.5 rounded bg-foreground/5 text-foreground/50 border border-foreground/10 font-mono">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent issues */}
      {(data as any).recent_issues?.length > 0 && (
        <div className="px-4 py-2.5 border-t border-foreground/5">
          <div className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1.5">Recent open issues</div>
          <div className="flex flex-col gap-1">
            {(data as any).recent_issues.map((issue: any) => (
              <a key={issue.number} href={issue.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-foreground/50 hover:text-foreground/80 transition-colors">
                <CircleDot size={10} className="text-emerald-400 shrink-0" />
                <span className="truncate">{issue.title}</span>
                <span className="text-foreground/30 shrink-0">#{issue.number}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IssueList({ issues }: { issues: IssueItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {issues.map((issue) => (
        <a
          key={issue.number}
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-foreground/10 hover:border-foreground/25 hover:bg-foreground/5 transition-all group"
        >
          <CircleDot
            size={14}
            className={`mt-0.5 shrink-0 ${issue.state === "open" ? "text-emerald-400" : "text-purple-400"}`}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-foreground group-hover:text-blue-400 transition-colors truncate">
              {issue.title}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-foreground/40 flex items-center gap-1">
                <Hash size={10} />{issue.number}
              </span>
              <span className="text-xs text-foreground/40 flex items-center gap-1">
                <Calendar size={10} />{timeAgo(issue.created_at)}
              </span>
            </div>
          </div>
          <ExternalLink size={12} className="text-foreground/30 shrink-0 mt-1" />
        </a>
      ))}
    </div>
  );
}

function CreatedIssueCard({ data }: { data: CreatedIssue }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
      <CheckCircle size={16} className="text-emerald-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">Issue created</div>
        <div className="text-xs text-foreground/50 mt-0.5">#{data.number} · {data.title}</div>
      </div>
      <a href={data.url} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={13} className="text-foreground/40 hover:text-foreground/80" />
      </a>
    </div>
  );
}

function DeleteConfirmCard({ data }: { data: DeleteConfirm }) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-amber-500/15">
        <AlertTriangle size={15} className="text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-amber-300">Confirmation required</span>
      </div>
      <div className="px-4 py-3 text-xs text-foreground/70 leading-relaxed">
        <p>{data.message}</p>
        <p className="mt-2 text-foreground/50">{data.instruction}</p>
      </div>
    </div>
  );
}

function DeleteResultCard({ data }: { data: DeleteResult }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
      <CheckCircle size={16} className="text-red-400 shrink-0" />
      <div>
        <div className="text-sm font-medium text-foreground">Repository deleted</div>
        <div className="text-xs text-foreground/50 mt-0.5">{data.repo}</div>
      </div>
    </div>
  );
}

// ── Replaces the raw "Blocked: read on github/issues" string ──
function AccessDeniedCard({ raw }: { raw: string }) {
  const match = raw.match(/blocked:\s*(.+)/i);
  const detail = match?.[1] ?? null;
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-red-500/10">
        <ShieldOff size={15} className="text-red-400 shrink-0" />
        <span className="text-sm font-semibold text-red-300">Access Denied</span>
      </div>
      <div className="px-4 py-3 space-y-1">
        <p className="text-xs text-foreground/60">
          This action is not permitted by your current security policies.
        </p>
        {detail && (
          <p className="text-xs font-mono text-foreground/35">{detail}</p>
        )}
        <p className="text-xs text-foreground/40 pt-1">
          Open <span className="text-foreground/60 font-medium">Policies &amp; Audit</span> to adjust permissions.
        </p>
      </div>
    </div>
  );
}

function ErrorCard({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
      <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
      <span className="text-sm text-red-300">{error}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Split "human sentence\n{json...}" reply
// ─────────────────────────────────────────────
function splitReply(content: string): { human: string; json: string | null } {
  const jsonStart = content.search(/[{[]/);
  if (jsonStart === -1) return { human: content.trim(), json: null };
  return {
    human: content.slice(0, jsonStart).trim(),
    json: content.slice(jsonStart).trim(),
  };
}

// ─────────────────────────────────────────────
// JSON → card
// ─────────────────────────────────────────────
function JsonCard({ raw }: { raw: string }) {
  let parsed: AgentEnvelope | null = null;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || !parsed.ok) return null;
  if (isResolvedRepo(parsed.data)) return null; // internal step — never show

  const data = parsed.data;

  if (isRepoArray(data))
    return <div className="mt-3 flex flex-col gap-2">{data.map((r) => <RepoCard key={r.url} repo={r} />)}</div>;

  if (isIssueArray(data))
    return <div className="mt-3"><IssueList issues={data} /></div>;

  if (isRepoDetails(data))
    return <div className="mt-3"><RepoDetailsCard data={data} /></div>;

  if (isDeleteConfirm(data))
    return <div className="mt-3"><DeleteConfirmCard data={data as DeleteConfirm} /></div>;

  if (isDeleteResult(data))
    return <div className="mt-3"><DeleteResultCard data={data as DeleteResult} /></div>;

  if (isCreatedIssue(data))
    return <div className="mt-3"><CreatedIssueCard data={data as CreatedIssue} /></div>;

  return null;
}

// ─────────────────────────────────────────────
// Master message renderer
// ─────────────────────────────────────────────
function AgentMessage({ content }: { content: string }) {
  // Firewall block string → show card, skip human text
  if (isBlockedMessage(content)) return <AccessDeniedCard raw={content} />;

  const { human, json } = splitReply(content);

  let parsedJson: AgentEnvelope | null = null;
  if (json) { try { parsedJson = JSON.parse(json); } catch { /* ignore */ } }

  const isError = parsedJson && !parsedJson.ok && !!parsedJson.error;

  return (
    <div className="flex flex-col gap-1 w-full">
      {human && (
        <p className="text-sm text-foreground leading-snug whitespace-pre-wrap">{human}</p>
      )}
      {isError && <ErrorCard error={parsedJson!.error!} />}
      {json && !isError && <JsonCard raw={json} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// Decision colors
// ─────────────────────────────────────────────
const DECISION_COLORS = {
  allow:    { bg: "rgba(16,185,129,0.1)", text: "#10b981", border: "rgba(16,185,129,0.2)", dot: "#10b981" },
  block:    { bg: "rgba(239,68,68,0.1)",  text: "#ef4444", border: "rgba(239,68,68,0.2)",  dot: "#ef4444" },
  "step-up":{ bg: "rgba(245,158,11,0.1)", text: "#f59e0b", border: "rgba(245,158,11,0.2)", dot: "#f59e0b" },
} as const;

// ─────────────────────────────────────────────
// Main ChatUI
// ─────────────────────────────────────────────
export default function ChatUI({ user }: { user: User }) {
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [showSheet, setShowSheet]     = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [policies, setPolicies]       = useState<PolicyRule[]>([]);
  const [auditLog, setAuditLog]       = useState<AuditEntry[]>([]);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [sheetTab, setSheetTab]       = useState<"policies" | "audit">("policies");
  const [stepUpRequired, setStepUpRequired] = useState(false);
  const [stepUpMessage, setStepUpMessage]   = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/policies").then(r => r.json()).then(d => setPolicies(Array.isArray(d.policies) ? d.policies : []));
    fetch("/api/audit").then(r => r.json()).then(d => setAuditLog(Array.isArray(d.log) ? d.log : []));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/audit").then(r => r.json()).then(d => setAuditLog(Array.isArray(d.log) ? d.log : []));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
      const res  = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();

      if (data.step_up_required) {
        setStepUpRequired(true);
        setStepUpMessage(data.message || "This action requires additional authentication");
        setPendingMessage(userMessage);
        setMessages(prev => prev.slice(0, -1).concat([{
          role: "assistant",
          content: `__stepup__${data.message || "Step-up authentication required"}`,
        }]));
        setLoading(false);
        return;
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply ?? data.error ?? "No response",
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleStepUpApprove() {
    setStepUpRequired(false);
    setInput(pendingMessage);
    setTimeout(() => sendMessage(), 100);
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  const decisionColor = (d: string) =>
    DECISION_COLORS[d as keyof typeof DECISION_COLORS] ?? {
      bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.4)",
      border: "rgba(255,255,255,0.1)", dot: "rgba(255,255,255,0.4)",
    };

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Header ── */}
      <header className="w-full relative z-999 bg-transparent flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5 pointer-events-none">
          <Shield size={28} />
          <div className="leading-tighter">
            <div className="text-sm font-bold tracking-tight">Guardian</div>
            <div className="text-[10px] text-foreground/50 tracking-wide uppercase font-medium">AI Agent Firewall</div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-foreground/5 rounded-full px-2 py-1.5"
          >
            {user.picture
              ? <img src={user.picture} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
              : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>{user.name?.[0] ?? "U"}</div>
            }
            <span className="text-xs font-medium">{user.nickname ?? user.name?.split(" ")[0] ?? "User"}</span>
            <ChevronDown size={16} className="text-foreground/50" />
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-99" onClick={() => setShowDropdown(false)} />
              <div className="absolute top-12 right-0 w-50 z-99 border border-foreground/10 rounded-xl bg-background backdrop-blur-md overflow-hidden p-3 shadow-xl">
                <div className="border-b border-foreground/10 pb-1.5">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-[11px] text-foreground/50 mt-1">{user.email ?? user.nickname}</div>
                </div>
                <div className="flex items-center gap-2 rounded-full text-xs my-3">
                  <span style={{ display:"inline-flex", width:6, height:6, borderRadius:"50%", background:"#10b981" }} />
                  Firewall Active
                </div>
                <div className="pt-1.5 border-t border-foreground/10">
                  <a href="/auth/logout" className="flex items-center gap-2 py-2 px-2.5 rounded-full border border-foreground/10 text-xs hover:bg-foreground/5 transition-colors">
                    <LogOut size={12} /> Sign out
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Chat area ── */}
      <main className="relative flex-1 overflow-y-auto">
        <div className="relative max-w-180 my-0 mx-auto">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 z-10 bg-linear-to-b from-background via-background/80 to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 z-10 bg-linear-to-t from-background via-background/80 to-transparent" />

          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 mb-5 mx-auto flex items-center justify-center">
                  <Shield className="w-15 h-15" strokeWidth={1.5} />
                </div>
                <h1 className="font-medium text-xl mb-3 text-foreground/70">What can I help with?</h1>
                <p className="text-sm text-foreground/50 max-w-2xl mx-auto mb-6 leading-tight">
                  Every action is intercepted by Guardian and evaluated against your security policies before execution.
                </p>
                <div className="flex flex-wrap gap-2 items-center justify-center">
                  {["List my GitHub repositories", "Which repos are private?", "Show my recent projects"].map(s => (
                    <button key={s} onClick={() => setInput(s)}
                      className="text-xs py-1 px-3 rounded-full border border-foreground/20 text-foreground/80 hover:bg-foreground/5 transition-colors cursor-pointer">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-foreground/10">
                        <Sparkles size={16} strokeWidth={1.75} />
                      </div>
                    )}

                    <div className={`text-sm leading-snug ${
                      msg.role === "user"
                        ? "bg-foreground/10 text-foreground rounded-full px-3 py-2 whitespace-pre-wrap max-w-[75%]"
                        : "w-full max-w-[85%] py-1.5"
                    }`}>
                      {msg.role === "assistant"
                        ? msg.content.startsWith("__stepup__")
                          // Step-up inline label
                          ? <div className="flex items-center gap-2 text-sm text-amber-400">
                              <Shield size={14} />
                              {msg.content.replace("__stepup__", "")}
                            </div>
                          : <AgentMessage content={msg.content} />
                        : msg.content
                      }
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-foreground/10">
                      <Sparkles size={16} strokeWidth={1.75} />
                    </div>
                    <div className="flex gap-1 items-center">
                      {[0, 0.15, 0.3].map((delay, idx) => (
                        <div key={idx} className="w-2 h-2 rounded-full bg-foreground/20"
                          style={{ animation: `bounce 1s ${delay}s infinite` }} />
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

      {/* ── Side sheet ── */}
      {showSheet && (
        <>
          <div className="fixed inset-0 bg-foreground/10 z-999 backdrop-blur-[3px]" onClick={() => setShowSheet(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-200 z-999 bg-background flex flex-col shadow-2xl px-6 py-5">
            <div className="flex items-center justify-between border-b border-foreground/10 pb-3">
              <div className="flex gap-1">
                {([{ id:"policies", label:"Policies" }, { id:"audit", label:"Audit" }] as const).map(tab => (
                  <button key={tab.id} onClick={() => setSheetTab(tab.id)}
                    className={`text-sm font-medium cursor-pointer transition-all py-1 px-3 rounded-full ${sheetTab === tab.id ? "text-foreground bg-foreground/5" : "text-foreground/50 hover:text-foreground"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowSheet(false)} className="cursor-pointer text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <div style={{ flex:1, overflowY:"auto" }}>
              {sheetTab === "policies" && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-foreground my-4 font-medium">Policy Rules</p>
                  <div className="flex flex-col gap-3">
                    {policies.map(policy => {
                      const colors = decisionColor(policy.decision);
                      return (
                        <div key={policy.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 transition">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{ background: colors.dot }} />
                            <div className="flex flex-col text-xs">
                              <span className="text-foreground/80 font-medium">{policy.provider}</span>
                              <span className="text-foreground/40">{policy.action} / {policy.resource}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {(["allow","block","step-up"] as const).map(d => {
                              const dc = decisionColor(d);
                              const active = policy.decision === d;
                              return (
                                <button key={d} onClick={() => updateDecision(policy.id, d)}
                                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${active ? "" : "border-transparent text-foreground/30 hover:text-foreground/70"}`}
                                  style={active ? { background:dc.bg, borderColor:dc.border, color:dc.text } : {}}>
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={savePolicies} disabled={saving}
                    className={`w-full mt-5 py-3 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                      saving ? "bg-foreground/5 text-foreground/30 border-foreground/10 cursor-not-allowed"
                      : saved ? "bg-foreground/10 text-foreground border-foreground/20"
                      : "bg-foreground/5 text-foreground/70 border-foreground/10 hover:bg-foreground/10"}`}>
                    {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
                  </button>
                </div>
              )}

              {sheetTab === "audit" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-wider text-foreground mt-4 font-medium">Audit Logs</p>
                  <p className="text-xs text-foreground/50 mb-4">Live activity · updates every 3s</p>
                  {[...auditLog].reverse().map((entry, i) => {
                    const colors = decisionColor(entry.decision);
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-foreground/5 bg-white/2 hover:bg-foreground/10 transition">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: colors.dot }} />
                        <span className="text-xs text-foreground/70 font-mono w-16 shrink-0">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                        </span>
                        <span className="text-xs font-mono text-foreground font-medium flex-1 truncate">
                          {entry.provider}/{entry.action}/{entry.resource}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ color: colors.text }}>
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

      {/* ── Input bar ── */}
      <div className="fixed z-50 max-w-3xl w-full mx-auto px-4 pb-6 -bottom-2 left-1/2 -translate-x-1/2">
        <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden shadow-md focus-within:ring-4 focus-within:ring-foreground/5">
          <textarea ref={textareaRef} value={input} onChange={handleTextareaChange}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask the agent something..." rows={1}
            className="w-full bg-transparent border-none outline-none resize-none px-4 pt-4 pb-2 text-[15px] text-foreground placeholder:text-foreground/40 leading-relaxed block font-normal"
          />
          <div className="flex items-center justify-between px-3 pb-3 pt-2">
            <button onClick={() => setShowSheet(!showSheet)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border transition-all bg-transparent border-foreground/30 text-foreground/80 hover:border-foreground/10 rounded-full cursor-pointer hover:bg-foreground/5">
              <SlidersVertical className="w-4 h-4" />
              Policies & Audit
            </button>
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-foreground/5 ${
                input.trim() && !loading
                  ? "bg-foreground text-background border-foreground hover:bg-foreground/90 active:scale-[0.97] cursor-pointer"
                  : "bg-transparent text-foreground/80 border-foreground/20 cursor-not-allowed"}`}>
              <Sparkles className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Step-up auth modal ── */}
      {stepUpRequired && (
        <>
          <div className="fixed inset-0 bg-foreground/20 z-9999 backdrop-blur-sm" onClick={() => setStepUpRequired(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-9999 bg-background border border-foreground/10 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Shield size={24} className="text-yellow-500" />
              </div>
            </div>
            <h2 className="text-center font-semibold text-lg mb-2">Step-Up Authentication Required</h2>
            <p className="text-center text-sm text-foreground/60 mb-6">
              {stepUpMessage || "This sensitive action requires you to authenticate again."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStepUpRequired(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-foreground/20 text-sm font-medium text-foreground/70 hover:bg-foreground/5 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleStepUpApprove}
                className="flex-1 px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-sm font-medium text-yellow-500 hover:bg-yellow-500/30 transition-colors cursor-pointer">
                Continue
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}