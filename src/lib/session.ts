import type { NextRequest } from "next/server";

export const STAFF_ROLES = ["admin", "editor", "moderator"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Decodes the Firebase ID token stored in the httpOnly cookie and returns its role claim. */
export function roleFromCookieValue(token?: string): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (decoded?.role as string) ?? null;
  } catch {
    return null;
  }
}

export function sessionRole(request: NextRequest): string | null {
  return roleFromCookieValue(request.cookies.get("firebaseToken")?.value);
}

/** True when the caller is any authenticated staff role (admin/editor/moderator). */
export function isStaff(request: NextRequest): boolean {
  const role = sessionRole(request);
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

/** True when the caller has exactly the given role(s). */
export function hasRole(request: NextRequest, ...roles: string[]): boolean {
  const role = sessionRole(request);
  return !!role && roles.includes(role);
}
