import type { InterviewTurn } from "@/lib/interview/types";

export type PacingDiagnostics = {
  mainQuestions: number;
  followUpsByQuestion: number[];
  averageFollowUps: number;
  maxConsecutiveFollowUps: number;
  zeroFollowUpShare: number;
  oneFollowUpShare: number;
  twoOrMoreShare: number;
  topicTransitions: number;
  elapsedMs: number;
  candidateQuestionsAtMs: number | null;
};

const transitionCue =
  /\b(let's|let us|shift|move on|moving on|i'd like to|i would like to|now i|talk about|switch|another|different)\b/i;
const candidateQuestionCue =
  /questions (do you have|for me)|anything you(?:'d| would) like to ask|what would you like to ask|questions you have/i;

export function pacingDiagnostics(turns: InterviewTurn[], elapsedMs: number): PacingDiagnostics {
  const questions = turns.filter((turn) => turn.speaker === "interviewer" && turn.text.includes("?"));
  const followUpsByQuestion: number[] = [];
  let followUps = 0;
  let mains = 0;
  let transitions = 0;
  let candidateQuestionsAtMs: number | null = null;

  for (const turn of questions) {
    if (candidateQuestionsAtMs === null && candidateQuestionCue.test(turn.text)) {
      candidateQuestionsAtMs = turn.timestampMs;
      if (mains > 0) followUpsByQuestion.push(followUps);
      mains = 0;
      followUps = 0;
      continue;
    }
    const startsTopic = mains === 0 || transitionCue.test(turn.text);
    if (startsTopic) {
      if (mains > 0) {
        followUpsByQuestion.push(followUps);
        if (transitionCue.test(turn.text)) transitions += 1;
      }
      mains += 1;
      followUps = 0;
    } else {
      followUps += 1;
    }
  }
  if (mains > 0) followUpsByQuestion.push(followUps);

  const count = followUpsByQuestion.length;
  const share = (predicate: (value: number) => boolean) =>
    count === 0 ? 0 : followUpsByQuestion.filter(predicate).length / count;

  return {
    mainQuestions: count,
    followUpsByQuestion,
    averageFollowUps: count === 0 ? 0 : followUpsByQuestion.reduce((sum, value) => sum + value, 0) / count,
    maxConsecutiveFollowUps: count === 0 ? 0 : Math.max(...followUpsByQuestion),
    zeroFollowUpShare: share((value) => value === 0),
    oneFollowUpShare: share((value) => value === 1),
    twoOrMoreShare: share((value) => value >= 2),
    topicTransitions: transitions,
    elapsedMs,
    candidateQuestionsAtMs,
  };
}
