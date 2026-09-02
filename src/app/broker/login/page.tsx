import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBroker } from "@/lib/auth/broker";
import { BrokerLogin } from "@/components/broker/BrokerLogin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Broker sign-in — Alternative Strategies" };

export default async function BrokerLoginPage() {
  if (await getBroker()) redirect("/broker");
  return <BrokerLogin />;
}
