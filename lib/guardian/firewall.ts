// lib/guardian/firewall.ts
import { evaluate, Provider, Action } from "./policy";
import { writeAuditLog } from "./audit";
import { TokenVaultError } from "@auth0/ai/interrupts";
import { z } from "zod";
import { tool, DynamicStructuredTool } from "@langchain/core/tools";

export function guardedTool(
  baseTool: DynamicStructuredTool,
  meta: { provider: Provider; action: Action; resource: string }
) {
  const { provider, action, resource } = meta;

  return tool(
    async (input: Record<string, unknown>) => {
        console.log("guardedTool called with input:", input);
      const decision = evaluate(provider, action, resource);

      await writeAuditLog({
        provider,
        action,
        resource,
        decision,
        timestamp: new Date().toISOString(),
      });

      if (decision === "block") {
        return `Blocked: your policy does not allow ${action} on ${provider}/${resource}.`;
      }

      if (decision === "step-up") {
        throw new TokenVaultError(
          `Authorization required to ${action} on ${provider}/${resource}. Please authenticate.`
        );
      }

      console.log("Firewall allowing, baseTool keys:", Object.keys(baseTool as any));
console.log("Has func?", typeof (baseTool as any).func);
      // decision === "allow" — call the underlying tool's function directly
      return (baseTool as any).func(input);
    },
    {
      name: baseTool.name,
      description: baseTool.description,
      schema: baseTool.schema ?? z.object({}),
    }
  );
}