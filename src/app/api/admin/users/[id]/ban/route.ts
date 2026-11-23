// src/app/api/admin/users/[id]/ban/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import { ADMIN_EMAIL } from "@/lib/admin";
import User from "@/lib/models/user";

const NO_STORE = { "Cache-Control": "no-store" };

function isAdmin(session: any): boolean {
  const role = String(session?.role ?? session?.user?.role ?? "").toLowerCase();
  const email = String(session?.email ?? session?.user?.email ?? "").toLowerCase();
  const adminEmail = String(ADMIN_EMAIL ?? "").toLowerCase();
  if (role === "admin" || role === "owner" || role === "superadmin") return true;
  if (adminEmail && email === adminEmail) return true;
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const banned = Boolean(body.banned);
  const reason = String(body.reason ?? "").slice(0, 300);

  await dbConnect();

  const user = await User.findByIdAndUpdate(
    id,
    {
      $set: {
        banned,
        bannedReason: banned ? reason : "",
        bannedAt: banned ? new Date() : null,
      },
    },
    { new: true }
  ).lean();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user }, { headers: NO_STORE });
}