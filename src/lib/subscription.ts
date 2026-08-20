// src/lib/subscription.ts

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
      "AI chart analysis (TP1 only)",
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
      "AI chart analysis (TP1 only)",
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
      "All risk management",
      "Priority support",
    ],
    tier: "vvip",
  },
];
