import { NextResponse, NextRequest } from "next/server";
import axios from "axios";
import { dbConnect } from "@/lib/db/mongodb";
import User from "@/lib/models/user";
import { SignJWT } from "jose";

const secretKey = process.env.NEXTAUTH_SECRET || "fallback-secret-key";
const key = new TextEncoder().encode(secretKey);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(new URL("/login?error=google", request.url));
    }

    const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: "https://tradevault-sepia.vercel.app/api/auth/google/callback",
      grant_type: "authorization_code",
    });

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { email, name, picture } = userResponse.data;

    await dbConnect();

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        name,
        email: email.toLowerCase(),
        image: picture,
        tier: "free",
        plan: "Free Trial",
        planExpiry: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        tradesUsed: 0,
        tradesLimit: 50,
      });
    }

    // Create JWT token directly
    const token = await new SignJWT({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(key);

    // Create response with redirect AND cookie
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Google login error:", error);
    return NextResponse.redirect(new URL("/login?error=google", request.url));
  }
}