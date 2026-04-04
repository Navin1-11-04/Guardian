import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { guardedTool } from "./guardian/firewall";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Octokit } from "octokit";
import { listGitHubIssues, createGitHubIssue } from "./guardian/github";
import {
  listGoogleDriveFiles,
  createGoogleDocument,
} from "./guardian/google-drive";

const model = new ChatGroq({ model: "llama-3.3-70b-versatile" });

const listRepositoriesTool = new DynamicStructuredTool({
  name: "list_repositories",
  description:
    "List the authenticated user's GitHub repositories. No arguments needed.",
  schema: z.object({}).passthrough(),
  func: async () => {
    try {
      console.log("Tool function executing...");
      const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        visibility: "all",
      });
      console.log("Repos fetched:", data.length);
      return JSON.stringify(
        data.map((r) => ({
          name: r.name,
          private: r.private,
          url: r.html_url,
        })),
      );
    } catch (err: any) {
      console.log("Tool error:", err.message);
      return `Error: ${err.message}`;
    }
  },
});

const createIssueToolDef = new DynamicStructuredTool({
  name: "create_github_issue",
  description:
    "Create a GitHub issue in a repository. Requires owner, repo name, issue title, and optional body.",
  schema: z.object({
    owner: z.string().describe("Repository owner username"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body: z.string().optional().describe("Issue body/description"),
  }),
  func: async (input: any) => {
    try {
      const result = await createGitHubIssue(
        input.owner,
        input.repo,
        input.title,
        input.body,
      );
      return JSON.stringify(result);
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});

const listGoogleFilesTool = new DynamicStructuredTool({
  name: "list_google_drive_files",
  description: "List files from user's Google Drive.",
  schema: z.object({
    limit: z
      .number()
      .optional()
      .describe("Maximum number of files to list (default 10)"),
  }),
  func: async (input: any) => {
    try {
      const files = await listGoogleDriveFiles(input.limit || 10);
      return JSON.stringify(files);
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});

const createGoogleDocTool = new DynamicStructuredTool({
  name: "create_google_document",
  description: "Create a new Google Document in the user's Google Drive.",
  schema: z.object({
    title: z.string().describe("Title of the new document"),
    content: z.string().optional().describe("Initial content for the document"),
  }),
  func: async (input: any) => {
    try {
      const result = await createGoogleDocument(input.title, input.content);
      return JSON.stringify(result);
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});

const tools = [
  guardedTool(listRepositoriesTool, {
    provider: "github",
    action: "read",
    resource: "repos",
  }),
  guardedTool(createIssueToolDef, {
    provider: "github",
    action: "write",
    resource: "issues",
  }),
  guardedTool(listGoogleFilesTool, {
    provider: "google",
    action: "read",
    resource: "files",
  }),
  guardedTool(createGoogleDocTool, {
    provider: "google",
    action: "write",
    resource: "documents",
  }),
];

export const agent = createReactAgent({ llm: model, tools });
