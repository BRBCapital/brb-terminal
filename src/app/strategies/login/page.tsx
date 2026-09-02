import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/auth/member";
import { MemberAuth } from "@/components/strategies/MemberAuth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in — Alternative Strategies" };

export default async function LoginPage() {
  if (await getMember()) redirect("/strategies/insights");
  return <MemberAuth mode="login" />;
}
