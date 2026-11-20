"use client";

import { useState } from "react";
import { searchKnowledge, FOREX_KNOWLEDGE_BASE } from "@/lib/forex-knowledge";
import {
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  CandlestickChart,
  Clock,
  GraduationCap,
  Landmark,
  LineChart,
  Medal,
  Ruler,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type Topic = { name: string; icon: LucideIcon; keywords: string };

const TOPICS: Topic[] = [
  { name: "Basics", icon: BookOpen, keywords: "what is forex" },
  { name: "Pips", icon: Ruler, keywords: "what is pip" },
  { name: "Leverage", icon: Zap, keywords: "what is leverage" },
  { name: "Support/Resistance", icon: LineChart, keywords: "support resistance" },
  { name: "Technical", icon: CandlestickChart, keywords: "technical analysis" },
  { name: "Fundamental", icon: Landmark, keywords: "fundamental analysis" },
  { name: "Risk", icon: ShieldCheck, keywords: "risk management" },
  { name: "Psychology", icon: Brain, keywords: "trading psychology" },
  { name: "Sessions", icon: Clock, keywords: "trading session" },
  { name: "Strategies", icon: Target, keywords: "trading strategy" },
  { name: "Gold", icon: Medal, keywords: "gold trading" },
  { name: "Prop Firms", icon: Briefcase, keywords: "prop firm" },
];

const DIFFICULTIES = ["Foundational", "Intermediate", "Advanced"] as const;

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
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forex Education AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {FOREX_KNOWLEDGE_BASE.length} topics covered · 500,000+ words of trading knowledge
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI advisor
        </div>
      </div>

      {/* Topics */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold tracking-tight">Lesson library</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <button
                key={topic.name}
                onClick={() => handleTopicClick(topic.name, topic.keywords)}
                className="hover-lift group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-card-hover"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <span className="block text-sm font-semibold">{topic.name}</span>
                  <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {DIFFICULTIES[TOPICS.indexOf(topic) % DIFFICULTIES.length]}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-primary">
                  Start lesson
                  <Send className="h-3 w-3" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Chat */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-5 py-4">
          <Bot className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold tracking-tight">Chat with AI advisor</h2>
        </div>

        <div className="h-[400px] space-y-3 overflow-y-auto p-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-brand-gradient text-white shadow-glow"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <p className="text-sm text-muted-foreground">Thinking...</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about forex trading..."
            className="h-10 w-full flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleSend}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </section>
    </div>
  );
}
