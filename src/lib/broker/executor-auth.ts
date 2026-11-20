import crypto from "crypto";

export function isExecutorConfigured(): boolean {
  return !!process.env.EXECUTOR_SECRET;
}

export function isExecutorAuthorized(request: Request): boolean {
  const secret = process.env.EXECUTOR_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;

  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}
