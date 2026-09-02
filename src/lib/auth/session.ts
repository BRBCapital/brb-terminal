import "server-only";
import { cookies } from "next/headers";
import { getUserBySession, type Role, type User } from "@/lib/db/users";

export { SESSION_COOKIE, sessionCookieOptions } from "./constants";
import { SESSION_COOKIE } from "./constants";

// Resolve the current user from the session cookie, or null.
export async function getSession(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserBySession(token);
}

const ROLE_RANK: Record<Role, number> = { analyst: 1, pm: 2, admin: 3 };

// Does `user` meet or exceed the required role? (admin ≥ pm ≥ analyst)
export function hasRole(user: User | null, min: Role): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[min];
}
