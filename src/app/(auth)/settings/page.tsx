"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [session, setSession] = useState<any>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        setSession(data.user);
        setName(data.user?.name || "");
      });
  }, []);

  if (!session) {
    return <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>Loading...</div>;
  }

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" };
  const labelStyle = { display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "6px" };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "24px" }}>Settings</h1>

      {session.email === "normanainebyoona7@gmail.com" && (
        <div style={{ background: "#f3e8ff", border: "1px solid #d8b4fe", borderRadius: "12px", padding: "16px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontWeight: "700", color: "#7c3aed" }}>Admin Access</p>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>Manage users and signals</p>
          </div>
          <Link href="/admin" style={{ padding: "10px 20px", background: "#7c3aed", color: "#fff", borderRadius: "8px", fontWeight: "600", textDecoration: "none" }}>
            Admin Panel
          </Link>
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Profile Information</h2>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Full Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={session.email} disabled style={{ ...inputStyle, background: "#f3f4f6", color: "#6b7280" }} />
        </div>

        <button style={{ padding: "12px 24px", background: "#1c69e3", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>
          Save Profile
        </button>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Subscription Plans</h2>
        
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <div>
              <p style={{ fontWeight: "700" }}>VIP Monthly</p>
              <p style={{ fontSize: "14px", color: "#6b7280" }}>UGX 55,000 / 30 days</p>
            </div>
            <button style={{ padding: "10px 20px", background: "#1c69e3", color: "#fff", borderRadius: "8px", fontWeight: "600", border: "none", cursor: "pointer" }}>
              Pay Now
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#faf5ff", borderRadius: "8px", border: "1px solid #d8b4fe" }}>
            <div>
              <p style={{ fontWeight: "700" }}>VVIP Monthly <span style={{ background: "#d8b4fe", color: "#7c3aed", padding: "2px 8px", borderRadius: "4px", fontSize: "10px" }}>PREMIUM</span></p>
              <p style={{ fontSize: "14px", color: "#6b7280" }}>UGX 150,000 / 30 days</p>
            </div>
            <button style={{ padding: "10px 20px", background: "#7c3aed", color: "#fff", borderRadius: "8px", fontWeight: "600", border: "none", cursor: "pointer" }}>
              Pay Now
            </button>
          </div>
        </div>

        <div style={{ marginTop: "16px", padding: "16px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
          <p style={{ fontWeight: "700", marginBottom: "8px" }}>📱 Pay via Mobile Money</p>
          <p style={{ fontSize: "14px" }}>Airtel: <strong>0701179229</strong></p>
          <p style={{ fontSize: "14px" }}>MTN: <strong>0783362906</strong></p>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: "12px", padding: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", color: "#dc2626" }}>Danger Zone</h2>
        <button style={{ padding: "10px 20px", background: "#dc2626", color: "#fff", borderRadius: "8px", fontWeight: "600", border: "none", cursor: "pointer" }}>
          Delete Account
        </button>
      </div>
    </div>
  );
}