// src/app/api/admin/ai-toggle/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import { ADMIN_EMAIL } from "@/lib/admin";
import { getGlobalConfig } from "@/lib/models/config";

const NO_STORE = { "Cache-Control": "no-store" };
export const dynamic = "force-dynamic";

function isAdmin(session: any): boolean {
  const role = String(session?.role ?? session?.user?.role ?? "").toLowerCase();
  const email = String(session?.email ?? session?.user?.email ?? "").toLowerCase();
  const adminEmail = String(ADMIN_EMAIL ?? "").toLowerCase();
  if (role === "admin" || role === "owner" || role === "superadmin") return true;
  if (adminEmail && email === adminEmail) return true;
  return false;
}

export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await dbConnect();
  const cfg = await getGlobalConfig();
  return NextResponse.json(
    {
      aiEnabled: cfg.aiEnabled,
      aiDisabledMessage: cfg.aiDisabledMessage,
      updatedBy: cfg.updatedBy,
      updatedAt: (cfg as any).updatedAt,
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  await dbConnect();
  const cfg = await getGlobalConfig();

  if (typeof body.aiEnabled === "boolean") cfg.aiEnabled = body.aiEnabled;
  if (typeof body.aiDisabledMessage === "string") {
    cfg.aiDisabledMessage = body.aiDisabledMessage.slice(0, 300);
  }
  cfg.updatedBy = String((session as any)?.email ?? "admin");
  await cfg.save();

  return NextResponse.json(
    { ok: true, aiEnabled: cfg.aiEnabled, aiDisabledMessage: cfg.aiDisabledMessage },
    { headers: NO_STORE }
  );
}