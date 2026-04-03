import { getPolicies, setPolicies, PolicyRule } from "@/lib/guardian/policy";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ policies: getPolicies() });
}

export async function POST(req: NextRequest) {
  const { policies } = await req.json();
  setPolicies(policies as PolicyRule[]);
  return NextResponse.json({ ok: true });
}