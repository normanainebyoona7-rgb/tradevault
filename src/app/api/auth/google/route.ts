import { NextResponse } from "next/server";

export async function GET() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || "";

  if (!googleClientId) {
    return NextResponse.redirect(new URL("/login?error=google_config", "https://tradevault-sepia.vercel.app"));
  }

  const redirectUri = "https://tradevault-sepia.vercel.app/api/auth/google/callback";

  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${googleClientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent("email profile")}` +
    `&access_type=online` +
    `&prompt=select_account`;

  return NextResponse.redirect(googleAuthUrl);
}