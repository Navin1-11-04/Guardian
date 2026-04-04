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
    async (input: Record<string, unknown>, config) => {
      const decision = evaluate(provider, action, resource);

      await writeAuditLog({
        provider,
        action,
        resource,
        decision,
        timestamp: new Date().toISOString(),
      });

      if (decision === "block") {
        return `Blocked: ${action} on ${provider}/${resource}`;
      }

      if (decision === "step-up") {
        throw new TokenVaultError(
          `Auth required for ${provider}/${resource}`
        );
      }

      // ✅ pass config properly
      return await (baseTool as any).func(input, config);
    },
    {
      name: baseTool.name,
      description: baseTool.description,
      schema: baseTool.schema ?? z.object({}),
    }
  );
}