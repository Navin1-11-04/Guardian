import { getAuditLog } from "@/lib/guardian/audit";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ log: getAuditLog() });
}