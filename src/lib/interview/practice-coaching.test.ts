import assert from "node:assert/strict";
import test from "node:test";
import { InterviewSession } from "../live/interview-session";
import { coachingInstruction, firstAttemptTurns, practiceCoachingPolicy, readPracticeMetadata, substantiveAnswer } from "./practice-coaching";
import { interviewPhase } from "./interview-phase";
import { pacingDiagnostics } from "./pacing-diagnostics";
import type { InterviewTurn } from "./types";

const question = "Tell me about a time you explained technical information to someone?";
const answer = "At work I built Tableau dashboards and worked on our supply planning project using TypeScript. I explained the data to colleagues and helped them understand the information.";
function harness(mode = "practice") {
  Object.assign(globalThis, { Audio: class { autoplay = false; className = ""; } });
  const session = new InterviewSession(null);
  // Exercise the real event/state implementation with a fake open data channel.
  const live = session as unknown as {
    ready: boolean; interviewMode: string; turns: InterviewTurn[]; openSpeaker: string | null;
    openText: string; lastCandidateSpeechAt: number; nudgedForTurn: boolean; startedAt: number;
    events: { readyState: string; send: (message: string) => void };
    practiceSpeechStarted: boolean; lastInterviewerSpeechAt: number; speakingUntil: number;
    settlePracticeSpeech(): void;
    promptContinue(): void; flushTurn(): void; onEventMessage(data: string): void;
    snapshot: ReturnType<typeof import("../live/interview-session").createSnapshot>;
  };
  const sent: Record<string, unknown>[] = [];
  live.ready = true;
  live.interviewMode = mode;
  live.startedAt = Date.now() - 1000;
  live.turns = [{ id: "q1", speaker: "interviewer", text: question, timestampMs: 0 }];
  live.openSpeaker = "candidate";
  live.openText = answer;
  live.lastCandidateSpeechAt = Date.now();
  live.events = { readyState: "open", send: message => sent.push(JSON.parse(message)) };
  return { session, live, sent };
}

test("only substantive Practice answers offer coaching", () => {
  assert.equal(substantiveAnswer("practice", question, answer), true);
  assert.equal(substantiveAnswer("mock", question, answer), false);
  for (const text of ["Yes.", "Thanks", "Could you repeat the question?", "What do you mean by technical?", "Can you hear me?", "I have a question about the role and the team and how they work together on these kinds of projects."]) {
    assert.equal(substantiveAnswer("practice", question, text), false, text);
  }
  assert.equal(substantiveAnswer("practice", "What questions do you have for me?", answer), false);
});

test("choice prevents next question; Continue uses normal progression without a coaching call", () => {
  const { session, live, sent } = harness();
  live.promptContinue();
  assert.equal(live.snapshot.practiceStage, "choice");
  assert.equal(sent.length, 0);
  live.promptContinue();
  assert.equal(sent.length, 0);
  session.practiceAction("continue");
  assert.equal(live.snapshot.practiceStage, "interviewing");
  assert.equal(sent.length, 1);
  assert.match(String(sent[0].content), /CONTINUE:.*chose to continue/);
  assert.doesNotMatch(String(sent[0].content), /COACH:/);
});

test("Mock and trivial turns retain ordinary progression", () => {
  const mock = harness("mock"); mock.live.promptContinue();
  assert.equal(mock.live.snapshot.practiceStage, "interviewing");
  assert.equal(mock.sent.length, 1);
  const trivial = harness(); trivial.live.openText = "Yes."; trivial.live.promptContinue();
  assert.equal(trivial.live.snapshot.practiceStage, "interviewing");
  assert.equal(trivial.sent.length, 1);
});

test("one coach and optional retry review preserve first attempt and same question", () => {
  const { session, live, sent } = harness();
  live.promptContinue();
  session.practiceAction("coach");
  assert.equal(live.snapshot.practiceStage, "coaching");
  assert.match(String(sent.at(-1)?.content), /firstAttempt/);
  assert.ok(String(sent.at(-1)?.content).includes(question));
  session.practiceAction("coach");
  session.practiceAction("continue");
  assert.equal(sent.length, 1);
  live.openSpeaker = "interviewer"; live.openText = "Focus on one example and finish with the actual outcome. Want to retry?"; live.flushTurn();
  live.lastInterviewerSpeechAt = Date.now() - 5000;
  live.settlePracticeSpeech();
  assert.equal(live.snapshot.practiceStage, "coaching", "must wait until coaching actually speaks");
  live.practiceSpeechStarted = true;
  live.speakingUntil = performance.now() + 10000;
  live.settlePracticeSpeech();
  assert.equal(live.snapshot.practiceStage, "coaching", "must wait for audible speech to finish");
  live.speakingUntil = 0;
  live.settlePracticeSpeech();
  assert.equal(live.snapshot.practiceStage, "retry-choice");
  session.practiceAction("retry");
  assert.match(String(sent.at(-1)?.content), /SAME competency/);
  assert.ok(String(sent.at(-1)?.content).includes(question));
  live.openSpeaker = "interviewer"; live.openText = question; live.flushTurn();
  live.openSpeaker = "candidate"; live.openText = "I chose the Tableau example. I explained my personal actions in detail and showed my colleagues how the dashboard made the information easier to understand.";
  live.nudgedForTurn = false; live.promptContinue();
  assert.equal(live.snapshot.practiceStage, "review-choice");
  session.practiceAction("coach");
  assert.equal(sent.length, 2);
  session.practiceAction("review");
  assert.equal(sent.length, 3);
  session.practiceAction("review");
  assert.equal(sent.length, 3);
  assert.match(String(sent.at(-1)?.content), /single issue you targeted/);
  assert.equal(live.turns.find(t => t.practice?.kind === "firstAttempt")?.text, answer);
  assert.equal(live.turns.find(t => t.practice?.kind === "firstAttempt")?.practice?.retryReviewUsed, true);
  const scored = firstAttemptTurns(live.turns);
  assert.equal(scored.length, 2);
  assert.equal(scored[1].text, answer);
  assert.deepEqual(pacingDiagnostics(live.turns, 10000), pacingDiagnostics(scored, 10000));
  assert.equal(live.snapshot.pausedMs, 0);
  assert.equal(live.snapshot.paused, false);
  assert.equal(live.snapshot.pauseEvents.length, 0);
});

test("coaching matches frameworks and includes explicit evidence boundaries", () => {
  for (const [q, framework] of [[question, "star"], ["Why this role?", "motivation"], ["How would you prioritize these tasks?", "structured_reasoning"], ["What interests you?", "direct"]]) {
    const instruction = coachingInstruction(q, answer, "recruiter");
    assert.ok(instruction.includes(`Framework: ${framework}`));
    assert.match(instruction, /Never invent experiences, results, metrics, responsibilities or company preferences/);
    assert.match(instruction, /If the result is missing, say it is missing/);
    assert.match(instruction, /ONLY if supported/);
    assert.match(instruction, /Omit unsupported company claims/);
  }
  assert.match(practiceCoachingPolicy, /wait silently/);
});

test("coaching turns cannot change interview phase; candidate questions and closing still work", () => {
  const { live } = harness();
  const turns: InterviewTurn[] = [...live.turns, { id: "c", speaker: "interviewer", text: "What questions do you have for me?", timestampMs: 1, practice: { questionId: "q1", kind: "coaching" } }];
  assert.equal(interviewPhase(turns, 1000, 30), "CORE");
  turns.push({ id: "invite", speaker: "interviewer", text: "What questions do you have for me?", timestampMs: 2 });
  assert.equal(interviewPhase(turns, 1000, 30), "CANDIDATE_QUESTIONS");
  turns.push({ id: "close", speaker: "interviewer", text: "Thanks for your time.", timestampMs: 3 });
  assert.equal(interviewPhase(turns, 1000, 30), "CLOSING");
});

test("attempt metadata survives validation", () => {
  assert.deepEqual(readPracticeMetadata({ questionId: "turn_2", kind: "firstAttempt", coachingUsed: true, retryReviewUsed: true }), { questionId: "turn_2", kind: "firstAttempt", coachingUsed: true, retryReviewUsed: true });
  assert.equal(readPracticeMetadata({ kind: "unknown" }), undefined);
});
