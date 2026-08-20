// src/app/api/payment/callback/route.ts

import { NextResponse, NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orderTrackingId = searchParams.get("OrderTrackingId");
  const status = searchParams.get("Status");

  console.log("📥 Payment callback:");
  console.log("   Order ID:", orderTrackingId);
  console.log("   Status:", status);

  return NextResponse.redirect(
    new URL(`/settings?payment=${status || "pending"}`, request.url),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  console.log("📥 IPN notification:", body);
  return NextResponse.json({ received: true });
}
