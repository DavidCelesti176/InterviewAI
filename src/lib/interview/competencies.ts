export type CompetencyId =
  | "motivation"
  | "conflict"
  | "teamwork"
  | "initiative"
  | "leadership"
  | "prioritization"
  | "problem_solving"
  | "judgment"
  | "failure"
  | "adaptability"
  | "communication"
  | "persuasion"
  | "customer_service"
  | "stress_management"
  | "attention_to_detail"
  | "data_analysis"
  | "process_improvement"
  | "ownership"
  | "commercial_thinking";

export type CompetencyPriority = "high" | "medium" | "low";

export type StoryCategory =
  | "conflict"
  | "initiative"
  | "failure"
  | "prioritization"
  | "teamwork"
  | "problem_solving"
  | "leadership"
  | "customer"
  | "adaptability";

export type Competency = {
  id: CompetencyId;
  label: string;
  evidence: string;
  learningApplies: boolean;
  storyCategories: StoryCategory[];
};

export const competencies: Competency[] = [
  { id: "motivation", label: "Motivation", evidence: "A specific reason tied to this role, company, or program.", learningApplies: false, storyCategories: [] },
  { id: "conflict", label: "Conflict", evidence: "What the disagreement was, what they personally did, and what changed.", learningApplies: true, storyCategories: ["conflict"] },
  { id: "teamwork", label: "Teamwork", evidence: "Their own contribution on a shared piece of work and the outcome.", learningApplies: false, storyCategories: ["teamwork"] },
  { id: "initiative", label: "Initiative", evidence: "A step they took before being asked, and what came of it.", learningApplies: false, storyCategories: ["initiative"] },
  { id: "leadership", label: "Leadership", evidence: "How they guided other people at a scale they have actually had.", learningApplies: false, storyCategories: ["leadership"] },
  { id: "prioritization", label: "Prioritization", evidence: "What they put first, what they delayed, and why.", learningApplies: false, storyCategories: ["prioritization"] },
  { id: "problem_solving", label: "Problem solving", evidence: "The problem, the action they took, and the result.", learningApplies: false, storyCategories: ["problem_solving"] },
  { id: "judgment", label: "Judgment", evidence: "The choice, the tradeoff, and what they learned from it.", learningApplies: true, storyCategories: ["problem_solving", "failure"] },
  { id: "failure", label: "Failure", evidence: "A real mistake, what they owned, and what they do differently now.", learningApplies: true, storyCategories: ["failure"] },
  { id: "adaptability", label: "Adaptability", evidence: "What changed, how they responded, and the result.", learningApplies: false, storyCategories: ["adaptability"] },
  { id: "communication", label: "Communication", evidence: "Who needed to understand, what they said, and whether it landed.", learningApplies: false, storyCategories: ["teamwork", "customer"] },
  { id: "persuasion", label: "Persuasion", evidence: "Whom they needed to convince, what they did, and what the person decided.", learningApplies: false, storyCategories: ["customer", "leadership"] },
  { id: "customer_service", label: "Customer service", evidence: "The customer's problem, what they did, and how it ended.", learningApplies: false, storyCategories: ["customer"] },
  { id: "stress_management", label: "Stress management", evidence: "What was pressing, what they did next, and the result.", learningApplies: false, storyCategories: ["adaptability", "prioritization"] },
  { id: "attention_to_detail", label: "Attention to detail", evidence: "What they checked, what they caught, and why it mattered.", learningApplies: false, storyCategories: ["problem_solving"] },
  { id: "data_analysis", label: "Data analysis", evidence: "The question in the data, what they did with it, and the result.", learningApplies: false, storyCategories: ["problem_solving"] },
  { id: "process_improvement", label: "Process improvement", evidence: "What was slow or messy, what they changed, and the result.", learningApplies: false, storyCategories: ["initiative"] },
  { id: "ownership", label: "Ownership", evidence: "What was theirs to finish, what they did, and the result.", learningApplies: false, storyCategories: ["initiative", "failure"] },
  { id: "commercial_thinking", label: "Commercial thinking", evidence: "The business consequence they noticed and what they did about it.", learningApplies: false, storyCategories: ["problem_solving", "customer"] },
];

const byId = new Map(competencies.map((item) => [item.id, item]));

const aliases: Record<string, CompetencyId> = {
  motivation: "motivation",
  conflict: "conflict",
  teamwork: "teamwork",
  "cross-functional teamwork": "teamwork",
  "cross functional teamwork": "teamwork",
  initiative: "initiative",
  leadership: "leadership",
  "formal leadership": "leadership",
  prioritization: "prioritization",
  "problem solving": "problem_solving",
  "problem-solving": "problem_solving",
  judgment: "judgment",
  judgement: "judgment",
  failure: "failure",
  "failure / learning": "failure",
  adaptability: "adaptability",
  communication: "communication",
  persuasion: "persuasion",
  "customer service": "customer_service",
  "stress management": "stress_management",
  "attention to detail": "attention_to_detail",
  "data analysis": "data_analysis",
  "process improvement": "process_improvement",
  ownership: "ownership",
  "commercial thinking": "commercial_thinking",
};

export function competencyById(id: string): Competency | null {
  return byId.get(id as CompetencyId) ?? null;
}

export function matchCompetency(name: string): Competency | null {
  const key = name.trim().toLowerCase().replaceAll("_", " ");
  const direct = key.replaceAll(" ", "_") as CompetencyId;
  const id = aliases[key] ?? (byId.has(direct) ? direct : null);
  return id ? (byId.get(id) ?? null) : null;
}

export function isCompetencyId(value: string): value is CompetencyId {
  return byId.has(value as CompetencyId);
}

export function coverageLimit(targetMinutes: number): { intendedHigh: number; backupMedium: number } {
  if (targetMinutes <= 10) return { intendedHigh: 3, backupMedium: 0 };
  return { intendedHigh: 5, backupMedium: 2 };
}

export type CoverageRole = "intended" | "backup" | "skip";

export type PlannedCompetency = {
  id: string;
  label: string;
  priority: CompetencyPriority;
  role: CoverageRole;
  evidence: string;
  framework: "star" | "motivation" | "structured_reasoning" | "direct";
  reason: string;
};

export function planCoverage(
  items: Array<{ competency: string; priority: CompetencyPriority; reason: string }>,
  targetMinutes: number,
): PlannedCompetency[] {
  const limit = coverageLimit(targetMinutes);
  const planned: PlannedCompetency[] = [];
  const seen = new Set<string>();
  let extras = 0;
  for (const item of items) {
    const match = matchCompetency(item.competency);
    const key = match?.id ?? item.competency.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    if (!match) {
      extras += 1;
      if (extras > 2) continue;
    }
    seen.add(key);
    planned.push({
      id: match?.id ?? "role_specific",
      label: match?.label ?? item.competency.trim(),
      priority: item.priority,
      role: "skip",
      evidence: match?.evidence ?? "A specific example at the candidate's real level of experience.",
      framework: !match ? "structured_reasoning" : match.id === "motivation" ? "motivation" : "star",
      reason: item.reason.trim(),
    });
  }
  let highs = 0;
  let mediums = 0;
  for (const item of planned) {
    if (item.priority === "high" && highs < limit.intendedHigh) {
      item.role = "intended";
      highs += 1;
    } else if (item.priority === "medium" && mediums < limit.backupMedium) {
      item.role = "backup";
      mediums += 1;
    } else {
      item.role = "skip";
    }
  }
  return planned;
}

export function privateInterviewFlow(targetMinutes: number): string {
  const limit = coverageLimit(targetMinutes);
  return `Do not announce interview phases. Ask one opening question, then motivation, then the ${limit.intendedHigh} intended high-priority competencies. Medium competencies are optional backups if time remains. Do not try to ask every high and medium competency. Use a different story when another credible example exists. Then stay with role topics that fit the candidate's experience, invite their questions, and close.`;
}
