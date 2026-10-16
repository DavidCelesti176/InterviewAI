import Link from "next/link";

import { PageShell } from "@/components/interview/page-shell";
import { supportEmail } from "@/lib/site";

export const metadata = {
  title: "Privacy · InterviewAI",
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <article className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Privacy</h1>
        <p>InterviewAI stores the account, résumé, interview, and billing records needed to run a practice interview and show your results.</p>
        <p>
          Sign-in uses Firebase Authentication. Interview audio is sent to OpenAI to run the live conversation and the written review. Payment details are entered on Stripe’s checkout page. InterviewAI does not store your card number.
        </p>
        <p>
          Billing records, including credits and subscription status, are written by the server. They are not readable from the browser. Interviews are saved to your account so you can review them later.
        </p>
        <p>
          To ask for a copy of your data or to delete your account, email <a className="text-accent" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
        <p>
          <Link href="/terms" className="text-accent">Terms</Link>
          {" · "}
          <Link href="/refunds" className="text-accent">Refunds</Link>
        </p>
      </article>
    </PageShell>
  );
}
