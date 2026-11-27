// src/lib/subscription.ts

import { isAdminEmail as isConfiguredAdminEmail } from "@/lib/admin";

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceUGX: number;
  priceUSD: string;
  durationDays: number;
  features: string[];
  tier: "free" | "vip" | "vvip";
}

export const MERCHANT_PHONE_NUMBERS = {
  airtel: "0701179229",
  mtn: "0783362906",
};

export const FREE_TRIAL_DAYS = 5;

/* Admins bypass tier gating entirely. */
export function isAdminEmail(email?: unknown): boolean {
  return isConfiguredAdminEmail(email == null ? null : String(email));
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free Trial",
    priceUGX: 0,
    priceUSD: "$0",
    durationDays: FREE_TRIAL_DAYS,
    features: [
      "5-day free trial",
      "50 trades limit",
      "Basic analytics",
      "Position calculator",
      "AI chart analysis (TP1 only)",
    ],
    tier: "free",
  },
  {
    id: "vip_weekly",
    name: "VIP Weekly",
    priceUGX: 15000,
    priceUSD: "$4",
    durationDays: 7,
    features: [
      "Unlimited trades",
      "AI chart analysis (TP1 + TP2)",
      "Advanced analytics",
    ],
    tier: "vip",
  },
  {
    id: "vip_monthly",
    name: "VIP Monthly",
    priceUGX: 55000,
    priceUSD: "$15",
    durationDays: 30,
    features: [
      "Unlimited trades",
      "AI chart analysis (TP1 + TP2)",
      "Advanced analytics",
    ],
    tier: "vip",
  },
  {
    id: "vvip_monthly",
    name: "VVIP Monthly",
    priceUGX: 150000,
    priceUSD: "$40",
    durationDays: 30,
    features: [
      "Everything in VIP",
      "Full AI analysis (TP1, TP2, TP3)",
      "Trade management & descriptions",
      "All risk management",
      "Priority support",
    ],
    tier: "vvip",
  },
];

// ============================================================================
// TIER ACCESS CONTROL
// ============================================================================

export type Tier = "free" | "vip" | "vvip";

export const TIER_ACCESS: Record<
  Tier,
  { tps: number[]; descriptions: boolean; label: string }
> = {
  free: { tps: [1], descriptions: false, label: "Free" },
  vip: { tps: [1, 2], descriptions: false, label: "VIP" },
  vvip: { tps: [1, 2, 3], descriptions: true, label: "VVIP" },
};

export function normalizeTier(raw: unknown): Tier {
  const t = String(raw ?? "").toLowerCase().trim();
  if (t === "vip") return "vip";
  if (t === "vvip") return "vvip";
  return "free";
}

/**
 * Resolve the effective tier for a session.
 * Admins (by email) always get "vvip" so they see everything.
 */
export function resolveTier(session: any): Tier {
  if (isAdminEmail(session?.email ?? session?.user?.email)) return "vvip";
  return normalizeTier(session?.tier);
}

export function gateSignal<T extends Record<string, any>>(
  payload: T,
  tier: Tier
): T & {
  access: {
    tier: Tier;
    label: string;
    lockedTps: number[];
    descriptions: boolean;
  };
} {
  const access = TIER_ACCESS[tier];
  const allowed = new Set(access.tps);
  const allTps = [1, 2, 3, 4];
  const lockedTps = allTps.filter((n) => !allowed.has(n));

  const clone: any = JSON.parse(JSON.stringify(payload));

  if (clone?.signal) {
    for (const n of lockedTps) {
      if (`takeProfit${n}Price` in clone.signal) {
        clone.signal[`takeProfit${n}Price`] = null;
      }
      if (`rewardPips${n}` in clone.signal) clone.signal[`rewardPips${n}`] = null;
      if (`riskReward${n}` in clone.signal) clone.signal[`riskReward${n}`] = null;
    }
    if (!access.descriptions) {
      if (Array.isArray(clone.signal.tradeManagement)) {
        clone.signal.tradeManagement = [];
      }
    }
  }

  if (clone?.smc) {
    for (const n of lockedTps) {
      if (`takeProfit${n}` in clone.smc) clone.smc[`takeProfit${n}`] = null;
    }
  }

  if (typeof clone.analysis === "string" && lockedTps.length > 0) {
    const lockedTpRegex = new RegExp(
      `^\\s*TP(${lockedTps.join("|")})\\b`,
      "i"
    );
    clone.analysis = clone.analysis
      .split("\n")
      .filter((ln: string) => !lockedTpRegex.test(ln))
      .join("\n");
  }

  clone.access = {
    tier,
    label: access.label,
    lockedTps,
    descriptions: access.descriptions,
  };
  return clone as any;
}