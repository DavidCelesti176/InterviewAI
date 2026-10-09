import { notFound } from "next/navigation";

import { DevBilling } from "@/app/dev/billing/dev-billing";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevBilling />;
}
