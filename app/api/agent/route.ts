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
      { messages: [new HumanMessage(message)] },
      { recursionLimit: 50 }
    );

    const messages = result.messages;

    // Priority 1: Check for tool messages with structured data FIRST
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m instanceof ToolMessage) {
        const raw = String(m.content);

        if (raw.startsWith("Blocked")) {
          return NextResponse.json({ reply: raw });
        }

        try {
          const parsed = JSON.parse(raw);
          
          // Check if step-up auth is required
          if (parsed.stepUpRequired) {
            return NextResponse.json({
              step_up_required: true,
              message: parsed.error,
              error: parsed.error
            }, { status: 401 });
          }
          
          if (!parsed.ok) {
            return NextResponse.json({ reply: `Error: ${parsed.error}` });
          }
          // Pass structured data through for card rendering
          return NextResponse.json({ reply: raw });
        } catch {
          return NextResponse.json({ reply: raw });
        }
      }
    }

    // Priority 2: Fall back to AI message with text response
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m instanceof AIMessage && typeof m.content === "string" && m.content.trim()) {
        return NextResponse.json({ reply: m.content });
      }
    }

    return NextResponse.json({ reply: "No response from agent" });

  } catch (error: any) {
    if (error instanceof TokenVaultError) {
      return NextResponse.json(
        { step_up_required: true, message: error.message, error: error.message },
        { status: 401 }
      );
    }
    console.error("Agent error:", error?.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}