import { auth0 } from "@/lib/auth0";
import { agent } from "@/lib/agents";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  console.log("SESSION USER:", session?.user);

  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const { message } = await req.json();

  try {
    // ✅ GET GITHUB TOKEN FROM AUTH0 CLAIM
    const githubToken =
      session.user["https://your-app/githubToken"];

    const result = await agent.invoke(
      {
        messages: [new HumanMessage(message)],
      },
      {
        configurable: {
          auth0: {
            githubToken, // ✅ pass correct token
          },
        },
      }
    );

    const messages = result.messages;

    // 🤖 AI response
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

    // 🔧 Tool response
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];

      if (m instanceof ToolMessage) {
        const raw = String(m.content);

        if (raw.includes("Error")) {
          return NextResponse.json({
            reply: `Agent error: ${raw}`,
          });
        }

        try {
          const parsed = JSON.parse(raw);

          if (Array.isArray(parsed)) {
            const formatted = parsed
              .map(
                (r: any) =>
                  `• ${r.name} (${r.private ? "private" : "public"})\n${r.url}`
              )
              .join("\n\n");

            return NextResponse.json({
              reply: `Your GitHub repositories:\n\n${formatted}`,
            });
          }
        } catch {
          return NextResponse.json({ reply: raw });
        }
      }
    }

    return NextResponse.json({
      reply: "No response from agent",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}