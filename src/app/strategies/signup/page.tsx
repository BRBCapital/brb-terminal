import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/auth/member";
import { MemberAuth } from "@/components/strategies/MemberAuth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request access — Alternative Strategies" };

export default async function SignupPage() {
  if (await getMember()) redirect("/strategies/insights");
  return <MemberAuth mode="signup" />;
}
