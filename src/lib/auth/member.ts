import "server-only";
import { cookies } from "next/headers";
import { getMemberBySession, type Member } from "@/lib/db/members";
import { MEMBER_COOKIE } from "./constants";

export { MEMBER_COOKIE, memberCookieOptions } from "./constants";

// Resolve the current external prospect ("member") from the member cookie, or
// null. Reads ONLY the member cookie — a valid internal staff session does not
// grant member access, and vice-versa.
export async function getMember(): Promise<Member | null> {
  const token = cookies().get(MEMBER_COOKIE)?.value;
  if (!token) return null;
  return getMemberBySession(token);
}
