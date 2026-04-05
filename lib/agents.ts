import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { guardedTool } from "./guardian/firewall";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Octokit } from "octokit";

// ─────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────
const model = new ChatOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Guardian AI Agent",
    },
  },
  model: "meta-llama/llama-3-8b-instruct",
  temperature: 0.1,
});

// ─────────────────────────────────────────────
// Shared Octokit factory
// ─────────────────────────────────────────────
const getOctokit = () => new Octokit({ auth: process.env.GITHUB_PAT });

// ─────────────────────────────────────────────
// Repo owner cache
// ─────────────────────────────────────────────
const repoOwnerCache = new Map<string, string>();

function cacheRepoOwners(repos: Array<{ name: string; url: string }>) {
  for (const r of repos) {
    const parts = r.url.split("/");
    const owner = parts[parts.length - 2];
    if (owner) repoOwnerCache.set(r.name.toLowerCase(), owner);
  }
}

function lookupOwner(repoName: string): string | undefined {
  return repoOwnerCache.get(repoName.toLowerCase());
}

async function ensureCachePopulated(): Promise<void> {
  if (repoOwnerCache.size > 0) return;
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    visibility: "all",
    per_page: 100,
    sort: "updated",
  });
  cacheRepoOwners(data.map((r) => ({ name: r.name, url: r.html_url })));
}

async function resolveOwner(repoName: string): Promise<{ owner: string; repo: string }> {
  await ensureCachePopulated();
  const exact = lookupOwner(repoName);
  if (exact) return { owner: exact, repo: repoName };
  const fuzzy = [...repoOwnerCache.entries()].find(([name]) =>
    name.includes(repoName.toLowerCase())
  );
  if (fuzzy) return { owner: fuzzy[1], repo: fuzzy[0] };
  throw new Error(`No repository matching "${repoName}" found in your account.`);
}

// ─────────────────────────────────────────────
// Result helpers
// ─────────────────────────────────────────────
interface StructuredResult<T> {
  ok: boolean;
  count?: number;
  data?: T;
  error?: string;
}

function ok<T>(data: T, count?: number): string {
  const result: StructuredResult<T> = { ok: true, data, ...(count !== undefined && { count }) };
  return JSON.stringify(result);
}

function fail(error: string): string {
  return JSON.stringify({ ok: false, error } satisfies StructuredResult<never>);
}

// ─────────────────────────────────────────────
// FIX 1 — wrapGuarded
// Converts firewall "Blocked: ..." plain-text strings into structured
// fail() JSON so the LLM gets a clear signal and tells the user to
// update their policies — instead of hanging in an infinite loop.
// ─────────────────────────────────────────────
function wrapGuarded(tool: DynamicStructuredTool): DynamicStructuredTool {
  const originalFunc = tool.func.bind(tool);
  // @ts-ignore
  tool.func = async (...args: any[]) => {
    const result = await originalFunc(...args);
    if (
      typeof result === "string" &&
      (result.toLowerCase().startsWith("blocked:") ||
        result.toLowerCase().includes("access denied") ||
        result.toLowerCase().includes("not permitted") ||
        result.toLowerCase().includes("security polic"))
    ) {
      return fail(
        `POLICY_BLOCKED: This action is blocked by your current Guardian security policy. ` +
        `Open "Policies & Audit" and set the relevant rule to "allow" to enable it.`
      );
    }
    return result;
  };
  return tool;
}

// ─────────────────────────────────────────────
// Pending delete store
// ─────────────────────────────────────────────
const pendingDeletes = new Map<string, { owner: string; repo: string; expiresAt: number }>();
const DELETE_TTL_MS = 60_000;
function deletionKey(owner: string, repo: string) { return `${owner}/${repo}`; }

// ─────────────────────────────────────────────
// Tool 1: List Repositories
// ─────────────────────────────────────────────
const listRepositoriesTool = new DynamicStructuredTool({
  name: "list_repositories",
  description: `List the authenticated user's GitHub repositories.
Use 'visibility' to filter: "all" (default), "public", or "private".
Use 'since_days' to filter repos updated within the last N days.
Use 'limit' to cap results (default 20).`,
  schema: z.object({
    visibility: z.enum(["all", "public", "private"]).default("all"),
    since_days: z.number().optional(),
    limit: z.number().default(20),
    sort: z.enum(["updated", "created", "pushed", "full_name"]).default("updated"),
  }),
  func: async ({ visibility, since_days, limit, sort }) => {
    try {
      const octokit = getOctokit();
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        visibility, sort, per_page: 100, direction: "desc",
      });

      cacheRepoOwners(data.map((r) => ({ name: r.name, url: r.html_url })));

      let repos = data.map((r) => ({
        name: r.name,
        private: r.private,
        url: r.html_url,
        language: r.language ?? null,
        updated_at: r.updated_at ?? null,
        stars: r.stargazers_count ?? 0,
      }));

      if (since_days !== undefined) {
        const cutoff = Date.now() - since_days * 86_400_000;
        repos = repos.filter((r) => r.updated_at && new Date(r.updated_at).getTime() >= cutoff);
      }

      repos = repos.slice(0, limit);
      return ok(repos, repos.length);
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

// ─────────────────────────────────────────────
// Tool 2: Resolve Repo Owner
// ─────────────────────────────────────────────
const resolveRepoTool = new DynamicStructuredTool({
  name: "resolve_repo_owner",
  description: `Resolve the correct owner for a GitHub repository by name.
Call this whenever the user mentions a repo by name only.`,
  schema: z.object({
    repo: z.string().describe("Repository name to look up (case-insensitive)"),
  }),
  func: async ({ repo }) => {
    try {
      const resolved = await resolveOwner(repo);
      return ok({ ...resolved, source: "resolved" });
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

// ─────────────────────────────────────────────
// Tool 3: Get Repository Details
// ─────────────────────────────────────────────
const getRepoDetailsTool = new DynamicStructuredTool({
  name: "get_repository_details",
  description: `Get detailed info about a single GitHub repository.`,
  schema: z.object({
    owner: z.string().describe("Repository owner username"),
    repo: z.string().describe("Repository name"),
  }),
  func: async ({ owner, repo }) => {
    let resolvedOwner = owner;
    let resolvedRepo = repo;
    try {
      const fromCache = await resolveOwner(repo);
      resolvedOwner = fromCache.owner;
      resolvedRepo = fromCache.repo;
    } catch { /* proceed with provided owner */ }

    try {
      const octokit = getOctokit();
      const { data: r } = await octokit.rest.repos.get({ owner: resolvedOwner, repo: resolvedRepo });
      return ok({
        name: r.name, owner: r.owner.login, private: r.private,
        url: r.html_url, description: r.description, language: r.language,
        stars: r.stargazers_count, open_issues: r.open_issues_count,
        updated_at: r.updated_at, default_branch: r.default_branch,
      });
    } catch (err: any) {
      if (err.status === 404) return fail(`Repository "${resolvedOwner}/${resolvedRepo}" not found.`);
      return fail(err.message);
    }
  },
});

// ─────────────────────────────────────────────
// Tool 4: List Issues
// FIX 2 — Explicitly returns count: 0 with empty array so the LLM
// always has a signal to say "no issues" instead of silently hanging.
// ─────────────────────────────────────────────
const listIssuesTool = new DynamicStructuredTool({
  name: "list_issues",
  description: `List issues for a GitHub repository.
Filter by state: "open" (default), "closed", or "all".
IMPORTANT: If the result has count: 0, you MUST tell the user there are no issues. Never be silent.`,
  schema: z.object({
    owner: z.string(),
    repo: z.string(),
    state: z.enum(["open", "closed", "all"]).default("open"),
    limit: z.number().default(10),
  }),
  func: async ({ owner, repo, state, limit }) => {
    let resolvedOwner = owner;
    let resolvedRepo = repo;
    try {
      const resolved = await resolveOwner(repo);
      resolvedOwner = resolved.owner;
      resolvedRepo = resolved.repo;
    } catch { /* proceed */ }

    try {
      const octokit = getOctokit();
      const { data } = await octokit.rest.issues.listForRepo({
        owner: resolvedOwner, repo: resolvedRepo, state, per_page: limit,
      });

      const issues = data.map((i) => ({
        number: i.number, title: i.title, state: i.state,
        url: i.html_url, created_at: i.created_at,
      }));

      // Always include count — 0 is a valid, meaningful result
      return ok(issues, issues.length);
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

// ─────────────────────────────────────────────
// Tool 5: Create Issue
// ─────────────────────────────────────────────
const createIssueTool = new DynamicStructuredTool({
  name: "create_github_issue",
  description: `Create a GitHub issue in a repository.`,
  schema: z.object({
    owner: z.string(),
    repo: z.string(),
    title: z.string(),
    body: z.string().optional(),
    labels: z.array(z.string()).optional(),
  }),
  func: async ({ owner, repo, title, body, labels }) => {
    let resolvedOwner = owner;
    let resolvedRepo = repo;
    try {
      const resolved = await resolveOwner(repo);
      resolvedOwner = resolved.owner;
      resolvedRepo = resolved.repo;
    } catch { /* proceed */ }

    try {
      const octokit = getOctokit();
      const { data } = await octokit.rest.issues.create({
        owner: resolvedOwner, repo: resolvedRepo,
        title, body: body ?? "", labels: labels ?? [],
      });
      return ok({ number: data.number, title: data.title, url: data.html_url, state: data.state });
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

// ─────────────────────────────────────────────
// Tool 6 (NEW): Close Issue
// FIX 3 — Was completely missing. Adds support for "close issue" commands.
// If the user gives a title, the LLM should call list_issues first to
// find the number, then call this tool.
// ─────────────────────────────────────────────
const closeIssueTool = new DynamicStructuredTool({
  name: "close_github_issue",
  description: `Close an open GitHub issue by its number.
Use when user says "close issue #N" or "close the [title] issue".
If the user gives a title instead of a number, call list_issues first to find the number.`,
  schema: z.object({
    owner: z.string().describe("Repository owner username"),
    repo: z.string().describe("Repository name"),
    issue_number: z.number().describe("The issue number to close"),
  }),
  func: async ({ owner, repo, issue_number }) => {
    let resolvedOwner = owner;
    let resolvedRepo = repo;
    try {
      const resolved = await resolveOwner(repo);
      resolvedOwner = resolved.owner;
      resolvedRepo = resolved.repo;
    } catch { /* proceed */ }

    try {
      const octokit = getOctokit();
      const { data } = await octokit.rest.issues.update({
        owner: resolvedOwner,
        repo: resolvedRepo,
        issue_number,
        state: "closed",
      });
      return ok({
        number: data.number,
        title: data.title,
        state: data.state,
        url: data.html_url,
        closed: true,
      });
    } catch (err: any) {
      if (err.status === 404) return fail(`Issue #${issue_number} not found in "${resolvedOwner}/${resolvedRepo}".`);
      return fail(err.message);
    }
  },
});

// ─────────────────────────────────────────────
// Tool 7: Request Delete Confirmation
// ─────────────────────────────────────────────
const requestDeleteConfirmationTool = new DynamicStructuredTool({
  name: "request_delete_confirmation",
  description: `⚠️ ALWAYS call this FIRST before deleting any repository.`,
  schema: z.object({
    owner: z.string(),
    repo: z.string(),
  }),
  func: async ({ owner, repo }) => {
    let resolvedOwner = owner;
    let resolvedRepo = repo;
    try {
      const resolved = await resolveOwner(repo);
      resolvedOwner = resolved.owner;
      resolvedRepo = resolved.repo;
    } catch { /* proceed */ }

    const key = deletionKey(resolvedOwner, resolvedRepo);
    pendingDeletes.set(key, { owner: resolvedOwner, repo: resolvedRepo, expiresAt: Date.now() + DELETE_TTL_MS });

    return ok({
      confirmation_required: true,
      message: `⚠️ You are about to permanently delete "${resolvedOwner}/${resolvedRepo}". This cannot be undone.`,
      instruction: `To confirm, call delete_repository with confirmed: true. Expires in 60 seconds.`,
      repo: `${resolvedOwner}/${resolvedRepo}`,
    });
  },
});

// ─────────────────────────────────────────────
// Tool 8: Delete Repository
// ─────────────────────────────────────────────
const deleteRepoTool = new DynamicStructuredTool({
  name: "delete_repository",
  description: `Permanently delete a GitHub repository. Must call request_delete_confirmation first.`,
  schema: z.object({
    owner: z.string(),
    repo: z.string(),
    confirmed: z.boolean(),
  }),
  func: async ({ owner, repo, confirmed }) => {
    if (!confirmed) return fail("Deletion blocked: call request_delete_confirmation first.");

    let resolvedOwner = owner;
    let resolvedRepo = repo;
    try {
      const resolved = await resolveOwner(repo);
      resolvedOwner = resolved.owner;
      resolvedRepo = resolved.repo;
    } catch { /* proceed */ }

    const key = deletionKey(resolvedOwner, resolvedRepo);
    const pending = pendingDeletes.get(key);

    if (!pending) return fail(`No pending confirmation for "${resolvedOwner}/${resolvedRepo}".`);
    if (Date.now() > pending.expiresAt) {
      pendingDeletes.delete(key);
      return fail(`Confirmation expired for "${resolvedOwner}/${resolvedRepo}". Request again.`);
    }

    try {
      const octokit = getOctokit();
      await octokit.rest.repos.delete({ owner: resolvedOwner, repo: resolvedRepo });
      pendingDeletes.delete(key);
      return ok({ deleted: true, repo: `${resolvedOwner}/${resolvedRepo}`, message: `Repository "${resolvedRepo}" permanently deleted.` });
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

// ─────────────────────────────────────────────
// Guarded + wrapped tools
// wrapGuarded converts firewall blocks into structured errors (Fix 1)
// ─────────────────────────────────────────────
const tools = [
  wrapGuarded(guardedTool(listRepositoriesTool,          { provider: "github", action: "read",   resource: "repos"  })),
  wrapGuarded(guardedTool(resolveRepoTool,               { provider: "github", action: "read",   resource: "repos"  })),
  wrapGuarded(guardedTool(getRepoDetailsTool,            { provider: "github", action: "read",   resource: "repos"  })),
  wrapGuarded(guardedTool(listIssuesTool,                { provider: "github", action: "read",   resource: "issues" })),
  wrapGuarded(guardedTool(createIssueTool,               { provider: "github", action: "write",  resource: "issues" })),
  wrapGuarded(guardedTool(closeIssueTool,                { provider: "github", action: "write",  resource: "issues" })),
  wrapGuarded(guardedTool(requestDeleteConfirmationTool, { provider: "github", action: "delete", resource: "repos"  })),
  wrapGuarded(guardedTool(deleteRepoTool,                { provider: "github", action: "delete", resource: "repos"  })),
];

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a GitHub assistant with access to the user's repositories and issues.

## POLICY BLOCKS — CRITICAL RULE
If any tool returns an error containing "POLICY_BLOCKED", you MUST immediately stop and reply:
"This action is blocked by your Guardian security policy. Open **Policies & Audit** and set the relevant rule to **allow** to enable it."
Do NOT retry. Do NOT call any other tools. Just reply once and stop.

## EMPTY RESULTS — CRITICAL RULE
If list_issues returns count: 0 or an empty array, you MUST reply with a plain-English message like:
"There are no open issues on [repo] right now."
Never stay silent when a list is empty.

## OWNER RESOLUTION
- Always call resolve_repo_owner first when user mentions a repo by name only.
- Use returned { owner, repo } in all subsequent calls.

## CLOSE ISSUE FLOW
User gives a title → list_issues to find the number → close_github_issue({ owner, repo, issue_number })
User gives a number → resolve_repo_owner → close_github_issue directly

## DELETE FLOW — MANDATORY TWO STEPS
1. request_delete_confirmation → show warning
2. Wait for explicit user "yes" / "confirm"
3. delete_repository with confirmed: true

## OUTPUT FORMAT — MANDATORY
1. One short human sentence
2. Raw JSON on a new line (skip JSON for errors, policy blocks, and empty results — plain English only)

Never output only JSON. Never describe the JSON. One sentence max for the human part.`;


export const agent = createReactAgent({
  llm: model,
  tools,
  messageModifier: SYSTEM_PROMPT,
});