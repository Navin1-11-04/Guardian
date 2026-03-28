// lib/guardian/policy.ts

export type Action = "read" | "write" | "delete" | "send";
export type Provider = "github" | "google" | "slack";

export interface PolicyRule {
  id: string;
  provider: Provider;
  action: Action;
  resource: string;       // e.g. "repos", "calendar", "issues"
  decision: "allow" | "block" | "step-up";
}

// Default policy — safe baseline
const DEFAULT_POLICIES: PolicyRule[] = [
  { id: "1", provider: "github", action: "read",   resource: "repos",    decision: "allow" },
  { id: "2", provider: "github", action: "write",  resource: "repos",    decision: "step-up" },
  { id: "3", provider: "github", action: "delete", resource: "repos",    decision: "block" },
  { id: "4", provider: "google", action: "read",   resource: "calendar", decision: "allow" },
  { id: "5", provider: "google", action: "write",  resource: "calendar", decision: "step-up" },
];

// In-memory store for now (swap for DB later)
let policies: PolicyRule[] = [...DEFAULT_POLICIES];

export function getPolicies() { return policies; }
export function setPolicies(p: PolicyRule[]) { policies = p; }

export function evaluate(
  provider: Provider,
  action: Action,
  resource: string
): "allow" | "block" | "step-up" {
  const rule = policies.find(
    (p) => p.provider === provider && p.action === action && p.resource === resource
  );
  return rule?.decision ?? "block"; // default-deny if no rule
}