import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBroker } from "@/lib/auth/broker";
import { BrokerPortal } from "@/components/broker/BrokerPortal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Broker portal — Alternative Strategies" };

export default async function BrokerHome() {
  const broker = await getBroker();
  if (!broker) redirect("/broker/login");
  return <BrokerPortal broker={broker} />;
}
