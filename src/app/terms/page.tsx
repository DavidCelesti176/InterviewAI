import Link from "next/link";

import { PageShell } from "@/components/interview/page-shell";
import { supportEmail } from "@/lib/site";

export const metadata = {
  title: "Terms · InterviewAI",
};

export default function TermsPage() {
  return (
    <PageShell>
      <article className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Terms</h1>
        <p>InterviewAI is a practice tool. It is not an employer, and a practice session is not a job interview or a hiring decision.</p>
        <p>One 10-minute practice is free. Thirty interview minutes are $8.99 and do not expire. Plus is $14.99 a month and includes 90 interview minutes each billing period. Prices are charged in US dollars through Stripe.</p>
        <p>You keep the account you create. Do not share login details. You are responsible for the résumé and answers you provide. Do not upload someone else’s private information.</p>
        <p>
          Refunds are described on the <Link href="/refunds" className="text-accent">refund page</Link>. Questions about these terms can go to <a className="text-accent" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      </article>
    </PageShell>
  );
}
