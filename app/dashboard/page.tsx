"use client";

import { useEffect, useState } from "react";

type Decision = "allow" | "block" | "step-up";

interface PolicyRule {
  id: string;
  provider: string;
  action: string;
  resource: string;
  decision: Decision;
}

interface AuditEntry {
  provider: string;
  action: string;
  resource: string;
  decision: string;
  timestamp: string;
}

const DECISION_STYLES: Record<Decision, string> = {
  allow: "bg-green-500 text-white",
  block: "bg-red-500 text-white",
  "step-up": "bg-yellow-500 text-black",
};

export default function Dashboard() {
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => setPolicies(d.policies));

    fetch("/api/audit")
      .then((r) => r.json())
      .then((d) => setAuditLog(d.log));
  }, []);

  // Poll audit log every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/audit")
        .then((r) => r.json())
        .then((d) => setAuditLog(d.log));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function updateDecision(id: string, decision: Decision) {
    setPolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, decision } : p))
    );
  }

  async function savePolcies() {
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

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🛡️ Guardian — Policy Dashboard</h1>
        <a href="/" className="text-sm text-blue-400 hover:underline">
          ← Back to Chat
        </a>
      </div>

      {/* Policy Rules */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Policy Rules</h2>
        <div className="rounded-lg border border-zinc-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800 text-zinc-400">
              <tr>
                <th className="text-left px-4 py-3">Provider</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Resource</th>
                <th className="text-left px-4 py-3">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {policies.map((policy) => (
                <tr key={policy.id} className="bg-zinc-900 hover:bg-zinc-800">
                  <td className="px-4 py-3 font-mono">{policy.provider}</td>
                  <td className="px-4 py-3 font-mono">{policy.action}</td>
                  <td className="px-4 py-3 font-mono">{policy.resource}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {(["allow", "block", "step-up"] as Decision[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => updateDecision(policy.id, d)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-opacity ${
                            DECISION_STYLES[d]
                          } ${policy.decision === d ? "opacity-100 ring-2 ring-white" : "opacity-30"}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={savePolcies}
          disabled={saving}
          className="mt-3 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </section>

      {/* Audit Log */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Live Audit Log
          <span className="ml-2 text-xs text-zinc-400">(refreshes every 3s)</span>
        </h2>
        <div className="rounded-lg border border-zinc-700 overflow-hidden max-h-72 overflow-y-auto">
          {auditLog.length === 0 ? (
            <p className="text-zinc-500 text-sm p-4">
              No audit entries yet. Try chatting with the agent.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-800 text-zinc-400 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">Provider</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Resource</th>
                  <th className="text-left px-4 py-3">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {[...auditLog].reverse().map((entry, i) => (
                  <tr key={i} className="bg-zinc-900">
                    <td className="px-4 py-2 text-zinc-400 text-xs">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 font-mono">{entry.provider}</td>
                    <td className="px-4 py-2 font-mono">{entry.action}</td>
                    <td className="px-4 py-2 font-mono">{entry.resource}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          DECISION_STYLES[entry.decision as Decision] ??
                          "bg-zinc-600 text-white"
                        }`}
                      >
                        {entry.decision}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Add link on chat page */}
      <p className="text-xs text-zinc-500">
        Changes to policies take effect immediately on the next agent tool call.
      </p>
    </main>
  );
}