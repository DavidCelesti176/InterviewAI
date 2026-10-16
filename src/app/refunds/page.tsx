import Link from "next/link";

import { PageShell } from "@/components/interview/page-shell";
import { supportEmail } from "@/lib/site";

export const metadata = {
  title: "Refunds · InterviewAI",
};

export default function RefundsPage() {
  return (
    <PageShell>
      <article className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Refunds</h1>
        <p>If a paid interview credit does not appear, or a session fails before you can use it, email <a className="text-accent" href={`mailto:${supportEmail}`}>{supportEmail}</a> and we will restore the credit or refund the charge.</p>
        <p>A credit that has already been used for a completed interview is not refunded. Plus can be canceled from the billing page. Cancellation stops the next renewal. The current period stays available until it ends.</p>
        <p>
          <Link href="/terms" className="text-accent">Terms</Link>
          {" · "}
          <Link href="/privacy" className="text-accent">Privacy</Link>
        </p>
      </article>
    </PageShell>
  );
}
