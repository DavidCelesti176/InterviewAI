import { PageShell } from "@/components/interview/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  { title: "Add the role", body: "Paste the full job listing. We’ll pull out the company and role." },
  { title: "Share your resume", body: "A PDF gives the interviewer real context." },
  { title: "Step into the room", body: "Practice out loud, with follow-up questions." },
];

export default function Home() {
  return (
    <PageShell width="wide">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <header className="flex flex-col gap-6">
          <h1 className="max-w-xl text-5xl font-semibold tracking-tight sm:text-6xl">Practice the interview before it counts.</h1>
          <p className="max-w-xl text-lg text-muted">
            Upload your resume and job description and step into a realistic AI-led mock interview with intelligent
            follow-up questions.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/interview/new">Start a mock interview</ButtonLink>
            <ButtonLink href="#how-it-works" variant="secondary">
              See how it works
            </ButtonLink>
          </div>
        </header>
        <Card className="flex flex-col gap-5 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
            <p className="mt-2 text-2xl font-semibold">Northwind Logistics</p>
            <p className="text-muted">Operations Analyst</p>
          </div>
          <div className="flex items-end gap-1" aria-hidden="true">
            {[18, 32, 24, 44, 28, 36, 20].map((height, index) => (
              <span key={index} className="w-1.5 rounded-full bg-accent/70" style={{ height }} />
            ))}
          </div>
          <p className="text-sm text-muted">Interviewer · Listening</p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-background px-3 py-1">Follow-up questions</span>
            <span className="rounded-full bg-background px-3 py-1">Feedback after</span>
          </div>
        </Card>
      </div>
      <section id="how-it-works" className="grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <Card key={step.title} className="flex flex-col gap-2 p-5">
            <p className="text-sm font-medium text-accent">0{index + 1}</p>
            <h2 className="text-lg font-semibold">{step.title}</h2>
            <p className="text-sm text-muted">{step.body}</p>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}
