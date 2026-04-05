import { auth0 } from "@/lib/auth0";
import { agent } from "@/lib/agents";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { NextRequest, NextResponse } from "next/server";
import { TokenVaultError } from "@auth0/ai/interrupts";

export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { message } = await req.json();

  try {
    const result = await agent.invoke(
      {
        messages: [new HumanMessage(message)],
      },
      { recursionLimit: 100 }, // Prevent infinite loops from blocked tools
    );

    const messages = result.messages;

    // Try to find tool message with repo data first
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m instanceof ToolMessage) {
        const raw = String(m.content);

        // Handle blocked actions - clean error message
        if (raw.startsWith("Blocked")) {
          const action = raw.includes("read")
            ? "read"
            : raw.includes("write")
              ? "write"
              : raw.includes("delete")
                ? "delete"
                : "perform";
          return NextResponse.json({
            reply: `🔒 Access Denied\n\nThis ${action} action is not permitted by your security policies.\n\nCheck the Policies & Audit panel to adjust your permissions.`,
          });
        }

        // Handle API errors gracefully
        if (
          raw.startsWith("Error") ||
          raw.includes("400") ||
          raw.includes("tool_use_failed")
        ) {
          return NextResponse.json({
            reply:
              "⚠️ The agent encountered an issue. You may need to adjust your policies or try rephrasing your request.",
          });
        }

        try {
          const parsed = JSON.parse(raw);

          // Handle structured responses: { ok: true, data: {...}, count: N }
          if (parsed.ok === true && parsed.data !== undefined) {
            // Return the raw JSON so ChatUI can render cards
            return NextResponse.json({ reply: raw });
          }

          // Legacy: List of repos (plain array)
          if (Array.isArray(parsed) && parsed[0]?.url) {
            const formatted = parsed
              .map(
                (r: any) =>
                  `• ${r.name} (${r.private ? "private" : "public"})\n  ${r.url}`,
              )
              .join("\n\n");
            return NextResponse.json({
              reply: `Your GitHub repositories:\n\n${formatted}`,
            });
          }

          // Legacy: Created issue (plain object)
          if (parsed.number && parsed.url) {
            return NextResponse.json({
              reply: `✓ Issue #${parsed.number} created!\n\nTitle: ${parsed.title}\nURL: ${parsed.url}`,
            });
          }

          // Generic JSON
          return NextResponse.json({ reply: JSON.stringify(parsed, null, 2) });
        } catch {
          return NextResponse.json({ reply: raw });
        }
      }
    }

    // Find last AI message with real text
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m instanceof AIMessage &&
        typeof m.content === "string" &&
        m.content.trim()
      ) {
        return NextResponse.json({ reply: m.content });
      }
    }

    return NextResponse.json({ reply: "No response from agent" });
  } catch (error: any) {
    if (error instanceof TokenVaultError) {
      return NextResponse.json(
        {
          step_up_required: true,
          message: error.message,
          error: error.message,
        },
        { status: 401 },
      );
    }
    console.error("Agent error:", error?.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
