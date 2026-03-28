// lib/agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "langgraph/prebuilt";
import { listRepositoriesTool } from "./tools/github";
import { withGitHubConnection } from "./auth0-ai";
import { guardedTool } from "./guardian/firewall";

const model = new ChatOpenAI({ model: "gpt-4o-mini" });

const tools = [
  guardedTool(
    withGitHubConnection(listRepositoriesTool),
    { provider: "github", action: "read", resource: "repos" }
  ),
  // add more guarded tools here
];

export const agent = createReactAgent({ llm: model, tools });