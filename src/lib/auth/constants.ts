// Auth constants with no server-only / DB imports, so they're safe to import
// from edge middleware as well as server code.

export const SESSION_COOKIE = "brb_session";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV !== "development",
  maxAge: 7 * 24 * 60 * 60,
};

// External prospect portal — a DISTINCT cookie so member sessions and internal
// staff sessions never cross. The internal getSession() only reads SESSION_COOKIE;
// member helpers only read MEMBER_COOKIE.
export const MEMBER_COOKIE = "as_member";

export const memberCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV !== "development",
  maxAge: 30 * 24 * 60 * 60,
};

// Broker execution-partner portal — a third distinct cookie.
export const BROKER_COOKIE = "as_broker";

export const brokerCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV !== "development",
  maxAge: 14 * 24 * 60 * 60,
};
