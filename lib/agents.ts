import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { withGitHubConnection, getAccessToken } from "./auth0-ai";
import { guardedTool } from "./guardian/firewall";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TokenVaultError } from "@auth0/ai/interrupts";

const model = new ChatGroq({ model: "llama-3.3-70b-versatile" });

const listRepositoriesTool = new DynamicStructuredTool({
  name: "list_repositories",
  description: "List the authenticated user's GitHub repositories. No arguments needed.",
  schema: z.object({}).passthrough(),
  func: async () => {
    try {
      console.log("Tool function executing...");
      const accessToken = await getAccessToken();
      console.log("Token Vault access token received:", !!accessToken);
      const { Octokit } = await import("octokit");
      const octokit = new Octokit({ auth: accessToken });
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        visibility: "all",
      });
      console.log("Repos fetched:", data.length);
      return JSON.stringify(
        data.map((r) => ({ name: r.name, private: r.private, url: r.html_url }))
      );
    } catch (err: any) {
      console.log("Tool error:", err.message);
      if (err instanceof TokenVaultError) {
        return `Authentication required: ${err.message}`;
      }
      return `Error: ${err.message}`;
    }
  },
});

const tools = [
  guardedTool(
    withGitHubConnection(listRepositoriesTool) as unknown as DynamicStructuredTool,
    { provider: "github", action: "read", resource: "repos" }
  ),
];

export const agent = createReactAgent({ llm: model, tools });