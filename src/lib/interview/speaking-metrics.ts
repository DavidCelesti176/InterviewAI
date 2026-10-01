import type { SpeakingMetrics } from "@/lib/interview/analysis-types";
import type { InterviewTurn } from "@/lib/interview/types";

const fillers: Array<{ word: string; pattern: RegExp }> = [
  { word: "um", pattern: /\bum+\b/gi },
  { word: "uh", pattern: /\buh+\b/gi },
  { word: "you know", pattern: /\byou know\b/gi },
  { word: "basically", pattern: /\bbasically\b/gi },
  { word: "like", pattern: /(?:^|[,.]\s+)like\b/gi },
  { word: "actually", pattern: /(?:^|[,.]\s+)actually\b/gi },
];

export function speakingMetrics(turns: InterviewTurn[]): SpeakingMetrics {
  const candidate = turns.filter((turn) => turn.speaker === "candidate" && turn.text.trim());
  const text = candidate.map((turn) => turn.text).join(" ");
  const fillerWords = fillers
    .map((filler) => ({ word: filler.word, count: text.match(filler.pattern)?.length ?? 0 }))
    .filter((filler) => filler.count > 0);
  const durations = answerDurations(turns);
  const metrics: SpeakingMetrics = {};
  if (fillerWords.length > 0) {
    metrics.fillerWordCount = fillerWords.reduce((sum, filler) => sum + filler.count, 0);
    metrics.fillerWords = fillerWords;
  }
  if (durations.length > 0) {
    const total = durations.reduce((sum, seconds) => sum + seconds, 0);
    metrics.averageAnswerSeconds = Math.round(total / durations.length);
    metrics.longestAnswerSeconds = Math.round(Math.max(...durations));
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (words > 0 && total >= 8) metrics.approximateWordsPerMinute = Math.round(words / (total / 60));
  }
  return metrics;
}

function answerDurations(turns: InterviewTurn[]): number[] {
  const durations: number[] = [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    const next = turns[index + 1];
    if (!turn || turn.speaker !== "candidate" || !next) continue;
    const seconds = (next.timestampMs - turn.timestampMs) / 1000;
    if (seconds >= 2 && seconds <= 600) durations.push(seconds);
  }
  return durations;
}
