import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { guardedTool } from "./guardian/firewall";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Octokit } from "octokit";

const model = new ChatGroq({ model: "llama-3.3-70b-versatile" });

const getOctokit = () => new Octokit({ auth: process.env.GITHUB_PAT });

// ── Owner cache ──
const repoOwnerCache = new Map<string, string>();

function cacheRepos(repos: Array<{ name: string; url: string }>) {
  for (const r of repos) {
    const parts = r.url.split("/");
    const owner = parts[parts.length - 2];
    if (owner) repoOwnerCache.set(r.name.toLowerCase(), owner);
  }
}

async function resolveOwner(repoName: string): Promise<{ owner: string; repo: string }> {
  // Populate cache if empty
  if (repoOwnerCache.size === 0) {
    const { data } = await getOctokit().rest.repos.listForAuthenticatedUser({
      visibility: "all", per_page: 100,
    });
    cacheRepos(data.map(r => ({ name: r.name, url: r.html_url })));
  }

  const key = repoName.toLowerCase();
  const exact = repoOwnerCache.get(key);
  if (exact) return { owner: exact, repo: repoName };

  // Fuzzy match
  for (const [name, owner] of repoOwnerCache.entries()) {
    if (name.includes(key) || key.includes(name)) {
      return { owner, repo: name };
    }
  }

  throw new Error(`Repository "${repoName}" not found in your account.`);
}

function ok<T>(data: T, count?: number): string {
  return JSON.stringify({ ok: true, data, ...(count !== undefined && { count }) });
}

function fail(error: string): string {
  return JSON.stringify({ ok: false, error });
}

// ── Tool 1: List Repositories ──
const listRepositoriesTool = new DynamicStructuredTool({
  name: "list_repositories",
  description: "List the authenticated user's GitHub repositories. Filter by visibility: all, public, private.",
  schema: z.object({
    visibility: z.enum(["all", "public", "private"]).default("all"),
    limit: z.number().default(20),
  }),
  func: async ({ visibility, limit }) => {
    try {
      const { data } = await getOctokit().rest.repos.listForAuthenticatedUser({
        visibility, sort: "updated", per_page: 100, direction: "desc",
      });
      cacheRepos(data.map(r => ({ name: r.name, url: r.html_url })));
      const repos = data.slice(0, limit).map(r => ({
        name: r.name,
        private: r.private,
        url: r.html_url,
        language: r.language ?? null,
        updated_at: r.updated_at ?? null,
        stars: r.stargazers_count ?? 0,
      }));
      return ok(repos, repos.length);
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

// ── Tool 2: Get Repo Details ──
const getRepoDetailsTool = new DynamicStructuredTool({
  name: "get_repository_details",
  description: "Get full details about a single GitHub repository including description, issues count, branches, contributors, and more.",
  schema: z.object({
    repo: z.string().describe("Repository name"),
  }),
  func: async ({ repo }) => {
    try {
      const { owner, repo: resolvedRepo } = await resolveOwner(repo);
      const octokit = getOctokit();

      const [repoRes, issuesRes, branchesRes] = await Promise.all([
        octokit.rest.repos.get({ owner, repo: resolvedRepo }),
        octokit.rest.issues.listForRepo({ owner, repo: resolvedRepo, state: "open", per_page: 5 }),
        octokit.rest.repos.listBranches({ owner, repo: resolvedRepo, per_page: 5 }),
      ]);

      const r = repoRes.data;
      return ok({
        name: r.name,
        owner: r.owner.login,
        private: r.private,
        url: r.html_url,
        description: r.description ?? "No description",
        language: r.language ?? null,
        stars: r.stargazers_count,
        forks: r.forks_count,
        watchers: r.watchers_count,
        open_issues: r.open_issues_count,
        default_branch: r.default_branch,
        updated_at: r.updated_at,
        created_at: r.created_at,
        topics: r.topics ?? [],
        license: r.license?.name ?? null,
        recent_issues: issuesRes.data.map(i => ({
          number: i.number,
          title: i.title,
          url: i.html_url,
        })),
        branches: branchesRes.data.map(b => b.name),
      });
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

// ── Tool 3: List Issues ──
const listIssuesTool = new DynamicStructuredTool({
  name: "list_issues",
  description: "List issues for a GitHub repository.",
  schema: z.object({
    repo: z.string().describe("Repository name"),
    state: z.enum(["open", "closed", "all"]).default("open"),
    limit: z.number().default(10),
  }),
  func: async ({ repo, state, limit }) => {
    try {
      const { owner, repo: resolvedRepo } = await resolveOwner(repo);
      const { data } = await getOctokit().rest.issues.listForRepo({
        owner, repo: resolvedRepo, state, per_page: limit,
      });
      const issues = data.map(i => ({
        number: i.number,
        title: i.title,
        state: i.state,
        url: i.html_url,
        created_at: i.created_at,
      }));
      return ok(issues, issues.length);
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

// ── Tool 4: Create Issue ──
const createIssueTool = new DynamicStructuredTool({
  name: "create_github_issue",
  description: "Create a GitHub issue in a repository.",
  schema: z.object({
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body: z.string().optional().describe("Issue body"),
  }),
  func: async ({ repo, title, body }) => {
    try {
      const { owner, repo: resolvedRepo } = await resolveOwner(repo);
      const { data } = await getOctokit().rest.issues.create({
        owner, repo: resolvedRepo, title, body: body ?? "",
      });
      return ok({
        number: data.number,
        title: data.title,
        url: data.html_url,
        state: data.state,
      });
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

// ── Tool 5: Close Issue ──
const closeIssueTool = new DynamicStructuredTool({
  name: "close_github_issue",
  description: "Close an open GitHub issue by its number.",
  schema: z.object({
    repo: z.string().describe("Repository name"),
    issue_number: z.number().describe("The issue number to close"),
  }),
  func: async ({ repo, issue_number }) => {
    try {
      const { owner, repo: resolvedRepo } = await resolveOwner(repo);
      console.log(`Closing issue #${issue_number} in ${owner}/${resolvedRepo}`);
      const { data } = await getOctokit().rest.issues.update({
        owner,
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
      return fail(err.message);
    }
  },
});

// ── Tool 6: Delete Repo ──
const deleteRepoTool = new DynamicStructuredTool({
  name: "delete_repository",
  description: "Permanently delete a GitHub repository. Always warn user first.",
  schema: z.object({
    repo: z.string().describe("Repository name"),
  }),
  func: async ({ repo }) => {
    try {
      const { owner, repo: resolvedRepo } = await resolveOwner(repo);
      await getOctokit().rest.repos.delete({ owner, repo: resolvedRepo });
      return ok({ deleted: true, repo: `${owner}/${resolvedRepo}`, message: `Repository permanently deleted.` });
    } catch (err: any) {
      return fail(err.message);
    }
  },
});

const tools = [
  guardedTool(listRepositoriesTool,  { provider: "github", action: "read",   resource: "repos"  }),
  guardedTool(getRepoDetailsTool,    { provider: "github", action: "read",   resource: "repos"  }),
  guardedTool(listIssuesTool,        { provider: "github", action: "read",   resource: "issues" }),
  guardedTool(createIssueTool,       { provider: "github", action: "write",  resource: "issues" }),
  guardedTool(closeIssueTool,        { provider: "github", action: "write",  resource: "issues" }),
  guardedTool(deleteRepoTool,        { provider: "github", action: "delete", resource: "repos"  }),
];

const SYSTEM_PROMPT = `You are a GitHub assistant secured by Guardian AI Firewall.

## TOOLS
- list_repositories: list user repos
- get_repository_details: full details on one repo (pass repo name only)
- list_issues: list issues on a repo (pass repo name only)
- create_github_issue: create an issue (pass repo name only)
- close_github_issue: close an issue by number (pass repo name only + issue_number)
- delete_repository: delete a repo (warn user, requires policy allow)

## RULES
- ALWAYS pass just the repo name — the tools resolve the owner automatically
- If blocked by policy, say exactly: "This action is blocked by your Guardian security policy."
- If step-up required, stop and say authentication is required
- Keep responses concise — one sentence + data

## OUTPUT FORMAT
One short sentence, then raw JSON on next line if there is data to show.
Never describe the JSON structure.`;

export const agent = createReactAgent({
  llm: model,
  tools,
  messageModifier: SYSTEM_PROMPT,
});