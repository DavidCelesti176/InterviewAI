import { isConnectivityCheck, pacingDiagnostics } from "@/lib/interview/pacing-diagnostics";
import type { InterviewTurn } from "@/lib/interview/types";

export type InterviewPhase = "INTRO" | "CORE" | "LATE_CORE" | "CANDIDATE_QUESTIONS" | "CLOSING" | "COMPLETE";

const candidateQuestionCue =
  /questions (do you have|for me)|what questions do you have|anything you(?:'d| would) like to ask|what would you like to ask|your turn to ask/i;
const closingCue =
  /\b(thanks for (your time|coming|speaking)|that (concludes|wraps)|we(?:'ll| will) (end|stop|close)|good luck|have a (good|great) (day|rest))\b/i;

export function candidateQuestionsNotBeforeMinutes(targetMinutes: number): number {
  if (targetMinutes >= 45) return 34;
  if (targetMinutes >= 30) return 22;
  return Math.max(4, Math.round(targetMinutes * 0.75));
}

export function invitesCandidateQuestionsTooEarly(elapsedMs: number, targetMinutes: number): boolean {
  return elapsedMs < candidateQuestionsNotBeforeMinutes(targetMinutes) * 60_000;
}

export function interviewPhase(turns: InterviewTurn[], elapsedMs: number, targetMinutes: number): InterviewPhase {
  let phase: InterviewPhase = "INTRO";
  for (const turn of turns) {
    if (turn.speaker !== "interviewer" || !turn.text.trim()) continue;
    if (phase === "CANDIDATE_QUESTIONS" || phase === "CLOSING") {
      if (closingCue.test(turn.text)) phase = "CLOSING";
      continue;
    }
    if (candidateQuestionCue.test(turn.text)) {
      phase = "CANDIDATE_QUESTIONS";
      continue;
    }
    if (closingCue.test(turn.text) && !turn.text.includes("?")) {
      phase = "CLOSING";
      continue;
    }
    if (turn.text.includes("?")) phase = "CORE";
  }
  if (phase === "CORE" && !invitesCandidateQuestionsTooEarly(elapsedMs, targetMinutes)) return "LATE_CORE";
  return phase;
}

export function openingAnswerSeconds(turns: InterviewTurn[]): number | null {
  const first = turns.find((turn) => turn.speaker === "candidate" && turn.text.trim().length >= 40);
  if (!first) return null;
  const next = turns.find((turn) => turn.speaker === "interviewer" && turn.timestampMs > first.timestampMs);
  if (!next) return null;
  return Math.max(0, Math.round((next.timestampMs - first.timestampMs) / 1000));
}

export function buildContinueInstruction(input: {
  elapsedMs: number;
  targetMinutes: number;
  turns: InterviewTurn[];
  pendingCandidateText?: string;
}): string {
  const minutes = Math.max(0, Math.round(input.elapsedMs / 60_000));
  const target = input.targetMinutes > 0 ? input.targetMinutes : 30;
  const phase = interviewPhase(input.turns, input.elapsedMs, target);
  const pending = input.pendingCandidateText?.trim() ?? "";
  const pacing = pacingDiagnostics(input.turns, input.elapsedMs);
  const tooEarly = invitesCandidateQuestionsTooEarly(input.elapsedMs, target);
  const notBefore = candidateQuestionsNotBeforeMinutes(target);
  const connectivity = isConnectivityCheck(pending);

  if (phase === "CANDIDATE_QUESTIONS" || phase === "CLOSING") {
    return `Active time is about ${minutes} minutes. Phase: ${phase}.
Stay in candidate questions. Do not return to CORE and do not reopen an earlier interview question.
Answer the question they just asked, as the interviewer, from the role and what this interview has covered. If an internal detail is unknown, say you cannot speak to it beyond the role, then answer what you can.
If they are finished, close warmly. Do not ask another interview question.`;
  }

  const followUpNote =
    pacing.maxConsecutiveFollowUps >= 1
      ? "You already followed up on the current topic. Accept a complete answer and change topics. Ask another follow-up only if the answer is still vague or missed an important part."
      : "Most answers get zero or one follow-up. A second is only for a vague answer, a missed part, or an important claim that is still unclear.";

  const clock = tooEarly
    ? `Do not invite their questions and do not say the interview is winding down. That phase is not appropriate before about ${notBefore} minutes. Cover another high-priority competency you have not already covered well.`
    : `You may finish the current thread. Do not open a large new topic. If the important ground is covered, you may invite their questions. Once you do, stay there.`;

  const heard = connectivity
    ? `Their latest words were only a connectivity check, not an answer. Ignore that check. Continue from the answer they already gave, or ask the next question if you had not responded yet.`
    : `If the answer was complete, give a brief neutral acknowledgment and move on. Do not add a follow-up only because another good question is possible. If they are stuck because the question assumed more responsibility than they have had, rephrase it once into a project, a teammate, or a supervisor, then listen.`;

  return `Active time is about ${minutes} minutes of a ${target} minute interview. Phase: ${phase === "INTRO" ? "CORE" : phase}.
${clock}
Difficulty should breathe. After a demanding question, move to motivation, background, or another competency instead of probing harder.
${followUpNote}
${heard}
Challenge thinking about their own work. Do not ask for senior authority they have not had.
Ask one question, then wait.`;
}
