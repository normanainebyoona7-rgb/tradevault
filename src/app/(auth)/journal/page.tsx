import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db/mongodb";
import Trade from "@/lib/models/trade";
import mongoose from "mongoose";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await dbConnect();
  const userId = new mongoose.Types.ObjectId(session.id);
  const trades = await Trade.find({ userId }).sort({ entryDate: -1 }).lean();

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700" }}>Trade Journal</h1>
          <p style={{ color: "#6b7280" }}>{trades.length} trades logged</p>
        </div>
        <Link href="/journal/new" style={{ textDecoration: "none", padding: "10px 20px", background: "#1c69e3", color: "#fff", borderRadius: "8px", fontWeight: "600" }}>
          + New Trade
        </Link>
      </div>

      {trades.length > 0 ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {trades.map((trade: any) => (
            <Link key={trade._id.toString()} href={`/journal/${trade._id.toString()}`}
              style={{ textDecoration: "none", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontWeight: "700", color: "#111827" }}>
                  {trade.pair}{" "}
                  <span style={{ fontSize: "12px", color: trade.direction === "long" ? "#16a34a" : "#dc2626" }}>
                    {trade.direction?.toUpperCase()}
                  </span>
                </p>
                <p style={{ fontSize: "14px", color: "#6b7280" }}>
                  {new Date(trade.entryDate).toLocaleDateString()}
                </p>
              </div>
              <p style={{ fontWeight: "700", color: (trade.pnl || 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                {(trade.pnl || 0) >= 0 ? "+" : ""}${trade.pnl?.toFixed(2)}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
          <p style={{ color: "#6b7280", marginBottom: "16px" }}>No trades found.</p>
          <Link href="/journal/new" style={{ textDecoration: "none", padding: "10px 20px", background: "#1c69e3", color: "#fff", borderRadius: "8px", fontWeight: "600" }}>
            Log Your First Trade
          </Link>
        </div>
      )}
    </div>
  );
}