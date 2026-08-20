// src/app/api/payment/route.ts

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPesapalToken, submitOrder } from "@/lib/pesapal";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phoneNumber, planId } = body;

    if (!phoneNumber || !planId) {
      return NextResponse.json(
        { error: "Phone number and plan required" },
        { status: 400 },
      );
    }

    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    console.log(`📱 Payment initiated for ${plan.name} from ${phoneNumber}`);

    // Get Pesapal token
    const token = await getPesapalToken();

    // Submit order
    const orderId = `tradevault_${Date.now()}`;
    const redirectUrl = await submitOrder(token, {
      id: orderId,
      amount: plan.priceUGX,
      currency: "UGX",
      description: `TradeVault ${plan.name} Subscription`,
      email: session.email,
      firstName: session.name?.split(" ")[0] || "User",
      lastName: session.name?.split(" ")[1] || "User",
      phoneNumber: formatUgandaPhone(phoneNumber),
    });

    return NextResponse.json({
      success: true,
      message: "Payment initiated",
      redirectUrl,
    });
  } catch (error: any) {
    console.error("❌ Payment error:", error.message);
    return NextResponse.json(
      { error: error.message || "Payment failed" },
      { status: 500 },
    );
  }
}

function formatUgandaPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
  if (cleaned.startsWith("256")) cleaned = cleaned.substring(3);
  return `256${cleaned}`;
}
