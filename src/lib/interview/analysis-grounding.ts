import type { StarCoverage } from "@/lib/interview/star";

const numberPattern = /\d[\d,]*(?:\.\d+)?%?/g;

export function openingLengthIsFine(seconds: number): boolean {
  return seconds >= 40 && seconds <= 100;
}

export function ungroundedNumbers(answer: string, sources: string[]): string[] {
  const allowed = new Set(sources.join(" ").match(numberPattern) ?? []);
  return (answer.match(numberPattern) ?? []).filter((token) => !allowed.has(token));
}

export function groundImprovedAnswer(answer: string, sources: string[]): string {
  const allowed = new Set(sources.join(" ").match(numberPattern) ?? []);
  return answer.replace(numberPattern, (token) => (allowed.has(token) ? token : "[number not in the source]"));
}

export function showMissingEvidence(answer: string, coverage: StarCoverage | null): string {
  if (!coverage) return answer.trim();
  let text = answer.trim();
  if (coverage.result === "missing" && !/result not in the answer/i.test(text)) text = `${text} [result not in the answer]`.trim();
  if (coverage.learning === "missing" && !/learning not in the answer/i.test(text)) text = `${text} [learning not in the answer]`.trim();
  return text;
}

export function excessiveStoryReuse(recommendations: string[]): boolean {
  const named = recommendations.map((item) => item.trim()).filter((item) => item && item.toLowerCase() !== "needs a story");
  if (named.length < 3) return false;
  const counts = new Map<string, number>();
  for (const name of named) counts.set(name.toLowerCase(), (counts.get(name.toLowerCase()) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return top >= 3 && top / named.length >= 0.75;
}
