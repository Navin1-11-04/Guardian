// lib/guardian/firewall.ts
import { tool } from "@langchain/core/tools";
import { evaluate, Provider, Action } from "./policy";
import { writeAuditLog } from "./audit";
import { InterruptError } from "@auth0/ai/interrupts";

export function guardedTool(
  baseTool: ReturnType<typeof tool>,
  meta: { provider: Provider; action: Action; resource: string }
) {
  return tool(
    async (input: unknown) => {
      const { provider, action, resource } = meta;
      const decision = evaluate(provider, action, resource);

      await writeAuditLog({
        provider, action, resource,
        decision,
        timestamp: new Date().toISOString(),
      });

      if (decision === "block") {
        return `Blocked: your policy does not allow ${action} on ${provider}/${resource}.`;
      }

      if (decision === "step-up") {
        // This triggers Auth0 CIBA — pauses agent, sends push to user's phone
        throw new InterruptError(
          `Step-up authorization required to ${action} on ${provider}/${resource}. 
           Check your phone to approve.`
        );
      }

      // decision === "allow" — proceed normally
      return baseTool.invoke(input as any);
    },
    {
      name: baseTool.name,
      description: baseTool.description,
      schema: (baseTool as any).schema,
    }
  );
}