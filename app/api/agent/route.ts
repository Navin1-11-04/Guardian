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
    const result = await agent.invoke({
      messages: [new HumanMessage(message)],
    });

    const messages = result.messages;

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

    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m instanceof ToolMessage) {
        const raw = String(m.content);
        if (raw.startsWith("Error")) {
          return NextResponse.json({ reply: raw });
        }
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const formatted = parsed
              .map(
                (r: any) =>
                  `• ${r.name} (${r.private ? "private" : "public"})\n  ${r.url}`,
              )
              .join("\n\n");
            return NextResponse.json({
              reply: `Your GitHub repositories:\n\n${formatted}`,
            });
          } else if (parsed.id && parsed.number && parsed.url) {
            // GitHub issue creation response
            return NextResponse.json({
              reply: `✓ Issue created!\n\nTitle: ${parsed.title}\nIssue #${parsed.number}\nURL: ${parsed.url}`,
            });
          } else if (
            Array.isArray(parsed) &&
            parsed[0]?.name &&
            parsed[0]?.id
          ) {
            // Google Drive files list
            const formatted = parsed
              .map((f: any) => `• ${f.name}\n  ${f.webViewLink || ""}`)
              .join("\n\n");
            return NextResponse.json({
              reply: `Your Google Drive files:\n\n${formatted}`,
            });
          } else if (parsed.link && parsed.name) {
            // Google Document creation response
            return NextResponse.json({
              reply: `✓ Document created!\n\nTitle: ${parsed.name}\nURL: ${parsed.link}`,
            });
          }
        } catch {
          return NextResponse.json({ reply: raw });
        }
      }
    }

    return NextResponse.json({ reply: "No response from agent" });
  } catch (error: any) {
    // Handle step-up authentication requirement
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
