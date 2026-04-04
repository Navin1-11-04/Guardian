export type Action = "read" | "write" | "delete" | "send";
export type Provider = "github" | "google" | "slack";

export interface PolicyRule {
  id: string;
  provider: Provider;
  action: Action;
  resource: string;
  decision: "allow" | "block" | "step-up";
}

const DEFAULT_POLICIES: PolicyRule[] = [
  // GitHub Policies
  {
    id: "1",
    provider: "github",
    action: "read",
    resource: "repos",
    decision: "allow",
  },
  {
    id: "2",
    provider: "github",
    action: "write",
    resource: "issues",
    decision: "step-up",
  },
  {
    id: "3",
    provider: "github",
    action: "delete",
    resource: "repos",
    decision: "block",
  },

  // Google Drive Policies
  {
    id: "4",
    provider: "google",
    action: "read",
    resource: "files",
    decision: "allow",
  },
  {
    id: "5",
    provider: "google",
    action: "write",
    resource: "documents",
    decision: "step-up",
  },
  {
    id: "6",
    provider: "google",
    action: "send",
    resource: "share",
    decision: "step-up",
  },
];

let policies: PolicyRule[] = [...DEFAULT_POLICIES];

export function getPolicies() {
  return policies;
}
export function setPolicies(p: PolicyRule[]) {
  policies = p;
}

export function evaluate(
  provider: Provider,
  action: Action,
  resource: string,
): "allow" | "block" | "step-up" {
  const rule = policies.find(
    (p) =>
      p.provider === provider && p.action === action && p.resource === resource,
  );
  return rule?.decision ?? "block";
}
