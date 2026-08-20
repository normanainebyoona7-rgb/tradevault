// src/proxy.ts

import { NextResponse, NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secretKey = process.env.NEXTAUTH_SECRET || "fallback-secret-key";
const key = new TextEncoder().encode(secretKey);

async function getToken(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken(request);

  const protectedRoutes = [
    "/dashboard",
    "/journal",
    "/settings",
    "/ai-analysis",
    "/charts",
  ];
  const authRoutes = ["/login", "/register"];

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !token) {
    const callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, request.url),
    );
  }

  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/journal/:path*",
    "/settings/:path*",
    "/ai-analysis/:path*",
    "/charts/:path*",
    "/login",
    "/register",
  ],
};
