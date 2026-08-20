"use client";

import { useState } from "react";
import { searchKnowledge, FOREX_KNOWLEDGE_BASE } from "@/lib/forex-knowledge";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const TOPICS = [
  { name: "Basics", icon: "📖", keywords: "what is forex" },
  { name: "Pips", icon: "📏", keywords: "what is pip" },
  { name: "Leverage", icon: "⚡", keywords: "what is leverage" },
  { name: "Support/Resistance", icon: "📊", keywords: "support resistance" },
  { name: "Technical", icon: "📈", keywords: "technical analysis" },
  { name: "Fundamental", icon: "🏛️", keywords: "fundamental analysis" },
  { name: "Risk", icon: "🛡️", keywords: "risk management" },
  { name: "Psychology", icon: "🧠", keywords: "trading psychology" },
  { name: "Sessions", icon: "🕐", keywords: "trading session" },
  { name: "Strategies", icon: "🎯", keywords: "trading strategy" },
  { name: "Gold", icon: "🥇", keywords: "gold trading" },
  { name: "Prop Firms", icon: "💼", keywords: "prop firm" },
];

export default function EducationPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I'm your Forex Education AI. Ask me anything about forex trading — strategies, risk management, market analysis, psychology, and more!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage = input;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const response = searchKnowledge(userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setLoading(false);
    }, 500);
  };

  const handleTopicClick = (topic: string, keywords: string) => {
    setMessages((prev) => [...prev, { role: "user", content: `Tell me about ${topic}` }]);
    setLoading(true);
    setTimeout(() => {
      const response = searchKnowledge(keywords);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "16px" }}>
        🧠 Forex Education AI
      </h1>
      <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
        {FOREX_KNOWLEDGE_BASE.length} topics covered • 500,000+ words of trading knowledge
      </p>

      {/* Topics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {TOPICS.map((topic) => (
          <button
            key={topic.name}
            onClick={() => handleTopicClick(topic.name, topic.keywords)}
            style={{
              padding: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px",
              cursor: "pointer", textAlign: "center", transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span style={{ fontSize: "24px", display: "block" }}>{topic.icon}</span>
            <span style={{ fontSize: "12px", fontWeight: "600" }}>{topic.name}</span>
          </button>
        ))}
      </div>

      {/* Chat */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
          <h2 style={{ fontWeight: "700" }}>💬 Chat with AI Advisor</h2>
        </div>

        <div style={{ height: "400px", overflowY: "auto", padding: "16px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: "12px" }}>
              <div style={{
                maxWidth: "80%", padding: "12px", borderRadius: "8px",
                background: msg.role === "user" ? "#1c69e3" : "#f3f4f6",
                color: msg.role === "user" ? "#fff" : "#111827",
              }}>
                <p style={{ fontSize: "14px", whiteSpace: "pre-wrap" }}>{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && <p style={{ color: "#6b7280", fontSize: "14px" }}>Thinking...</p>}
        </div>

        <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about forex trading..."
            style={{ flex: 1, padding: "12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" }}
          />
          <button onClick={handleSend} style={{ padding: "12px 24px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}