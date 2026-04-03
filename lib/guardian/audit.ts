// lib/guardian/audit.ts
import { Provider, Action } from "./policy";

export interface AuditEntry {
  provider: Provider;
  action: Action;
  resource: string;
  decision: "allow" | "block" | "step-up";
  timestamp: string;
}

// In-memory audit log (swap for DB/file later)
const auditLog: AuditEntry[] = [];

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  auditLog.push(entry);
  console.log("[GUARDIAN AUDIT]", JSON.stringify(entry));
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}