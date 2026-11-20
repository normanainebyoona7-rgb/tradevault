export const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "normanainebyoona7@gmail.com";

export function isAdminEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
