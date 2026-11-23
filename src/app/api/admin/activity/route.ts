// src/app/api/admin/activity/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import { ADMIN_EMAIL } from "@/lib/admin";
import AnalysisEvent from "@/lib/models/analysis-event";
import User from "@/lib/models/user";

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

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const perUser = await AnalysisEvent.aggregate([
    {
      $group: {
        _id: "$userEmail",
        total: { $sum: 1 },
        today: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", new Date(dayKey(now))] }, 1, 0],
          },
        },
        week: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", weekAgo] }, 1, 0],
          },
        },
        lastAt: { $max: "$createdAt" },
        lastPair: { $last: "$pair" },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 100 },
  ]);

  const daily = await AnalysisEvent.aggregate([
    { $match: { createdAt: { $gte: weekAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const recent = await AnalysisEvent.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const users = await User.find().select("email tier banned name").lean();
  const userMap = new Map<string, any>(
    users.map((u: any) => [u.email, u])
  );

  const rows = perUser.map((r) => {
    const u = userMap.get(r._id);
    return {
      email: r._id,
      name: u?.name ?? "",
      tier: u?.tier ?? "free",
      banned: u?.banned ?? false,
      total: r.total,
      today: r.today,
      week: r.week,
      lastAt: r.lastAt,
      lastPair: r.lastPair,
    };
  });

  return NextResponse.json(
    {
      perUser: rows,
      daily,
      recentAlerts: recent,
      serverTime: now.toISOString(),
    },
    { headers: NO_STORE }
  );
}