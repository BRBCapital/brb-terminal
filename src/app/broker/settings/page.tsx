import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBroker } from "@/lib/auth/broker";
import { BrokerSettingsClient } from "@/components/broker/BrokerSettingsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "API keys — Alternative Strategies broker portal" };

export default async function BrokerSettingsPage() {
  const broker = await getBroker();
  if (!broker) redirect("/broker/login");
  return <BrokerSettingsClient broker={broker} />;
}
