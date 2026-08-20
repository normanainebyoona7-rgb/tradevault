"use client";

import { useState } from "react";
import Link from "next/link";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "XAU/USD", "XAG/USD", "BTC/USD", "ETH/USD"];
const SESSIONS = ["london", "new_york", "asian", "other"];

export default function NewTradePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    pair: "EUR/USD",
    direction: "long",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    positionSize: "",
    exitPrice: "",
    session: "london",
    strategy: "",
    tags: "",
    notes: "",
    entryDate: new Date().toISOString().slice(0, 16),
    exitDate: "",
  });

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        pair: form.pair,
        direction: form.direction,
        entryPrice: Number(form.entryPrice),
        stopLoss: Number(form.stopLoss),
        takeProfit: Number(form.takeProfit),
        positionSize: Number(form.positionSize),
        exitPrice: form.exitPrice ? Number(form.exitPrice) : null,
        session: form.session,
        strategy: form.strategy,
        tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()) : [],
        notes: form.notes,
        entryDate: new Date(form.entryDate),
        exitDate: form.exitDate ? new Date(form.exitDate) : null,
      };

      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create trade");
        setLoading(false);
        return;
      }

      window.location.href = "/journal";
    } catch (err) {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" };
  const labelStyle = { display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "6px" };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "24px" }}>New Trade Entry</h1>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Core Details</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Currency Pair</label>
              <select name="pair" value={form.pair} onChange={handleChange} style={inputStyle}>
                {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Direction</label>
              <select name="direction" value={form.direction} onChange={handleChange} style={inputStyle}>
                <option value="long">Long (Buy)</option>
                <option value="short">Short (Sell)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Entry Price</label>
              <input type="number" step="any" name="entryPrice" value={form.entryPrice} onChange={handleChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Stop Loss</label>
              <input type="number" step="any" name="stopLoss" value={form.stopLoss} onChange={handleChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Take Profit</label>
              <input type="number" step="any" name="takeProfit" value={form.takeProfit} onChange={handleChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Position Size (lots)</label>
              <input type="number" step="any" name="positionSize" value={form.positionSize} onChange={handleChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Exit Price (optional)</label>
              <input type="number" step="any" name="exitPrice" value={form.exitPrice} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Entry Date</label>
              <input type="datetime-local" name="entryDate" value={form.entryDate} onChange={handleChange} style={inputStyle} required />
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Categorization</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Session</label>
              <select name="session" value={form.session} onChange={handleChange} style={inputStyle}>
                {SESSIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ").toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Strategy</label>
              <input type="text" name="strategy" value={form.strategy} onChange={handleChange} placeholder="e.g., Trendline Bounce" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tags (comma separated)</label>
              <input type="text" name="tags" value={form.tags} onChange={handleChange} placeholder="#london, #trendline" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button type="submit" disabled={loading} style={{ flex: 1, padding: "14px", background: "#1c69e3", color: "#fff", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
            {loading ? "Saving..." : "Save Trade"}
          </button>
          <Link href="/journal" style={{ padding: "14px 24px", background: "#e5e7eb", color: "#111827", borderRadius: "8px", fontWeight: "600", textDecoration: "none" }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}