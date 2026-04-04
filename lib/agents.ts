import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { guardedTool } from "./guardian/firewall";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Octokit } from "octokit";

const model = new ChatGroq({ model: "llama-3.3-70b-versatile" });

const listRepositoriesTool = new DynamicStructuredTool({
  name: "list_repositories",
  description: "List the authenticated user's GitHub repositories. No arguments needed.",
  schema: z.object({}).passthrough(),
  func: async () => {
    try {
      console.log("Tool function executing...");
      // Use GITHUB_PAT — user is authenticated via Auth0 with GitHub
      const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        visibility: "all",
      });
      console.log("Repos fetched:", data.length);
      return JSON.stringify(
        data.map((r) => ({ name: r.name, private: r.private, url: r.html_url }))
      );
    } catch (err: any) {
      console.log("Tool error:", err.message);
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
];

export const agent = createReactAgent({ llm: model, tools });