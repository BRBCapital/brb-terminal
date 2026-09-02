import "server-only";
import { cookies } from "next/headers";
import { getBrokerBySession, type Broker } from "@/lib/db/brokers";
import { BROKER_COOKIE } from "./constants";

export { BROKER_COOKIE, brokerCookieOptions } from "./constants";

// Resolve the current broker from the broker cookie, or null. Reads ONLY the
// broker cookie — never crosses into staff (brb_session) or member (as_member).
export async function getBroker(): Promise<Broker | null> {
  const token = cookies().get(BROKER_COOKIE)?.value;
  if (!token) return null;
  return getBrokerBySession(token);
}
