import "server-only";
import nodemailer from "nodemailer";

// Transactional email. Uses SMTP when configured (SMTP_HOST/PORT/USER/PASS,
// MAIL_FROM); otherwise falls back to logging the message so local development
// works without a mail server. In production, set the SMTP_* vars.

let cached: nodemailer.Transporter | null | undefined;

function transport(): nodemailer.Transporter | null {
  if (cached !== undefined) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) {
    cached = null;
    return null;
  }
  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
  });
  return cached;
}

export const MAIL_FROM = process.env.MAIL_FROM || "Alternative Strategies <no-reply@alternativestrategies.ai>";

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  const t = transport();
  if (!t) {
    // Dev / unconfigured: don't fail the request, just log so links are usable.
    console.log(`[email] (no SMTP configured) to=${to} subject="${subject}"\n${text}`);
    return false;
  }
  try {
    await t.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    console.error("[email] send failed:", (err as Error)?.message);
    return false;
  }
}

// Absolute base URL for links in emails.
export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
