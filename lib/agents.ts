import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { guardedTool } from "./guardian/firewall";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Octokit } from "octokit";

const model = new ChatGroq({
  model: "llama-3.3-70b-versatile",
});

const listRepositoriesTool = new DynamicStructuredTool({
  name: "list_repositories",
  description: "List the authenticated user's GitHub repositories",
  schema: z.object({}).passthrough(),

  func: async (_, config) => {
    try {
      const githubToken =
        config?.configurable?.auth0?.githubToken;

      if (!githubToken) {
        throw new Error("No GitHub token found");
      }

      const octokit = new Octokit({ auth: githubToken });

      const { data } =
        await octokit.rest.repos.listForAuthenticatedUser({
          visibility: "all",
        });

      return JSON.stringify(
        data.map((repo) => ({
          name: repo.name,
          private: repo.private,
          url: repo.html_url,
        }))
      );
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});

// 🔒 Firewall wrap
const tools = [
  guardedTool(listRepositoriesTool, {
    provider: "github",
    action: "read",
    resource: "repos",
  }),
];

// 🤖 Agent
export const agent = createReactAgent({
  llm: model,
  tools,
});