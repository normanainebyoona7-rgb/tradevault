// src/lib/auth/session.ts

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secretKey = process.env.NEXTAUTH_SECRET || "fallback-secret-key";
const key = new TextEncoder().encode(secretKey);

export interface SessionPayload {
  id: string;
  name: string;
  email: string;
  [key: string]: unknown;
}

export async function encrypt(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function createSession(user: SessionPayload) {
  const token = await encrypt(user);
  const cookieStore = await cookies();

  // For local network (HTTP), secure must be false
  cookieStore.set("session", token, {
    httpOnly: false, // Changed to false so JS can also read it (debugging)
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return await decrypt(token);
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set("session", "", {
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
