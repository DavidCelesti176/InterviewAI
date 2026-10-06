"use client";

import { useEffect, useState } from "react";

import { AnimatedInterviewer } from "@/components/interview/avatar/animated-interviewer";
import { interviewerProfiles } from "@/components/interview/avatar/profile";

const claire = interviewerProfiles.find((profile) => profile.id === "claire") ?? interviewerProfiles[0];

const frames = [
  {
    mode: "speaking" as const,
    line: "You mentioned building dashboards for the sales team. What business problem were you trying to solve?",
    reply: "",
  },
  {
    mode: "listening" as const,
    line: "You mentioned building dashboards for the sales team. What business problem were you trying to solve?",
    reply: "The team needed a faster way to see which accounts were slipping before the weekly pricing review.",
  },
  {
    mode: "speaking" as const,
    line: "How did someone actually use that analysis?",
    reply: "The team needed a faster way to see which accounts were slipping before the weekly pricing review.",
  },
  {
    mode: "listening" as const,
    line: "How did someone actually use that analysis?",
    reply: "Sales used it the same week to decide which accounts to revisit.",
  },
];

export function InterviewDemo() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;
    const sync = () => {
      window.clearInterval(timer);
      if (media.matches) return;
      timer = window.setInterval(() => {
        setFrame((current) => (current + 1) % frames.length);
      }, 4200);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div
        className="pointer-events-none absolute -inset-8 rounded-[40px] bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.14),transparent_68%)]"
        aria-hidden="true"
      />
      <div className="landing-motion relative">
        <DemoCard frame={frames[frame]} index={frame} animate />
      </div>
      <div className="landing-still relative">
        <DemoCard frame={frames[1]} index={1} animate={false} />
      </div>
    </div>
  );
}

function DemoCard({
  frame,
  index,
  animate,
}: {
  frame: (typeof frames)[number];
  index: number;
  animate: boolean;
}) {
  const speaking = frame.mode === "speaking";
  return (
    <figure
      className="overflow-hidden rounded-[24px] border border-white/15 bg-card text-foreground shadow-[0_30px_70px_rgba(0,0,0,0.32)]"
      aria-label="Example of a live interview. Claire asks about dashboard work on your resume, hears the answer, then follows up on how the analysis was used."
    >
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="text-sm font-medium">Live practice</span>
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Example</span>
      </figcaption>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <Chip>Resume · Your experience</Chip>
          <Chip>Role · Sales Analyst</Chip>
          <Chip>Company · The posting</Chip>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="landing-portrait avatar-stage relative size-16 shrink-0 overflow-hidden rounded-[16px] bg-[radial-gradient(circle_at_50%_18%,#f7f4ef,#d5deea)] sm:size-20"
            data-avatar-state={speaking ? "speaking" : "listening"}
          >
            <div className="avatar-figure h-full">
              <AnimatedInterviewer id={animate ? "demo-claire" : "demo-claire-still"} look={claire.look} label="Claire, AI interviewer" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Claire</p>
            <p className="text-xs text-muted">AI interviewer</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className={`rounded-[18px] border p-3 sm:p-4 ${speaking ? "border-accent/30 bg-accent/[0.06]" : "border-line"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Claire</p>
              <Status active={speaking} label={speaking ? "Speaking" : "Asked"} />
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground">
              <span className={animate ? "landing-line inline-block" : "inline-block"} key={frame.line}>
                {frame.line}
              </span>
            </p>
          </div>
          <div className={`min-h-[5.75rem] rounded-[18px] border p-3 sm:p-4 ${speaking ? "border-line" : "border-accent/30 bg-accent/[0.06]"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">You</p>
              <Status active={!speaking} label={speaking ? "Waiting" : "Listening"} />
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {frame.reply ? (
                <span className={`inline-block text-foreground ${animate ? "landing-line" : ""}`} key={frame.reply}>
                  {frame.reply}
                </span>
              ) : (
                "Your answer shows up here."
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {frames.map((item, dot) => (
            <span key={item.line + dot} className={`h-1 flex-1 rounded-full ${dot === index ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
      </div>
    </figure>
  );
}

function Chip({ children }: { children: string }) {
  return <span className="rounded-full border border-line bg-background px-2.5 py-1 text-xs font-medium text-foreground">{children}</span>;
}

function Status({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? "text-accent" : "text-muted"}`}>
      {active ? <Wave /> : null}
      {label}
    </span>
  );
}

function Wave() {
  return (
    <span className="flex h-3.5 items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3].map((bar) => (
        <span key={bar} className="landing-bar w-0.5 rounded-full bg-accent" style={{ height: "100%", animationDelay: `${bar * 120}ms` }} />
      ))}
    </span>
  );
}
