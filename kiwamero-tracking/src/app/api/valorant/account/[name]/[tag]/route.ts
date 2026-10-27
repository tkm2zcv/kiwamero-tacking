import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/henrikdev";
import { hasOwnerAccess } from "@/lib/owner-access";

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string; tag: string }> }) {
  if (!(await hasOwnerAccess(req.headers))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { name, tag } = await ctx.params;
  try {
    return NextResponse.json({ status: 200, data: await getAccount(name, tag) });
  } catch (e) {
    console.error("Account lookup failed", e);
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
