import { InterviewHistory } from "@/components/interview/interview-history";
import { PageShell } from "@/components/interview/page-shell";
import { ButtonLink } from "@/components/ui/button";

export default function Home() {
  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Interviews</h1>
          <p className="mt-1 text-sm text-muted">Practice sessions and reviews saved in this browser.</p>
        </div>
        <ButtonLink href="/interview/new" className="w-fit">
          New interview
        </ButtonLink>
      </div>
      <InterviewHistory />
    </PageShell>
  );
}
