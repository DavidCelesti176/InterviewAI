import type { AssistanceType, InterviewAssistanceEvent, InterviewMode } from "@/lib/interview/help-types";

const helpLabels: Record<Exclude<AssistanceType, "pause">, string> = {
  rephrase: "Rephrasing the question",
  competency: "What the question is testing",
  structure: "Answer structure",
  experience_suggestions: "Finding an experience",
  repeat: "Hearing the question again",
};

export function helpTypeLabel(type: AssistanceType): string {
  if (type === "pause") return "Pause";
  return helpLabels[type];
}

export function coachingNote(events: InterviewAssistanceEvent[], question: string): string {
  const matches = events.filter((event) => event.type !== "pause" && event.question && questionsMatch(event.question, question));
  if (matches.length === 0) return "";
  const labels = [...new Set(matches.map((event) => helpTypeLabel(event.type).toLowerCase()))];
  return `You used ${labels.join(" and ")} before responding.`;
}

export function mostRequestedHelp(events: InterviewAssistanceEvent[]): string {
  const counts = new Map<AssistanceType, number>();
  for (const event of events) {
    if (event.type === "pause") continue;
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }
  let best: AssistanceType | null = null;
  let bestCount = 0;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best ? helpTypeLabel(best) : "";
}

export function helpRequestCount(events: InterviewAssistanceEvent[]): number {
  return events.filter((event) => event.type !== "pause").length;
}

export function assistanceContext(mode: InterviewMode, events: InterviewAssistanceEvent[], pausedMs: number): string {
  const help = events.filter((event) => event.type !== "pause");
  const lines = help.map((event) => `- ${helpTypeLabel(event.type)}${event.question ? ` on: ${event.question}` : ""}`);
  return `Session mode: ${mode === "practice" ? "practice, with coaching available" : "mock interview"}.
Paused time: ${Math.round(Math.max(0, pausedMs) / 1000)} seconds. Do not treat pauses as a performance penalty.
Help requests:
${lines.join("\n") || "None."}`;
}

function questionsMatch(left: string, right: string): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  const slice = 80;
  return a.includes(b.slice(0, slice)) || b.includes(a.slice(0, slice));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
