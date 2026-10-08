import { openingLengthIsFine } from "@/lib/interview/analysis-grounding";
import { rubricAnchors } from "@/lib/interview/analysis-rubric";
import { levelLabel } from "@/lib/interview/difficulty";
import { openingAnswerSeconds } from "@/lib/interview/interview-phase";
import { interviewTypeLabel } from "@/lib/interview/labels";
import type { InterviewBlueprint, InterviewConfig, InterviewTurn } from "@/lib/interview/types";

export const analysisInstructions = `You are an interview coach evaluating a completed mock interview.

Evaluate the candidate relative to the role seniority, the job description, the interview type, the company style when it is reliable, and the candidate's experience. A recent graduate is not an executive. A senior manager should show greater scope, leadership, and strategic judgment. A recruiter screen emphasizes communication, motivation, fit, and clarity. A role-specific interview emphasizes relevant knowledge and applied thinking. A behavioral interview emphasizes specific past examples.

This is a coaching read of a practice interview. Do not estimate whether the candidate will get the job, pass a screen, or receive an offer.

Do not reward long answers. Do not punish a short answer that was complete. Use what was actually said. Quote or closely paraphrase the transcript. Avoid generic praise and harsh language. If the conversation does not show a skill, say that and keep the score near the middle of the scale.

A useful opening is about 45 to 90 seconds. A few seconds outside that range, including about 40 or about 100 seconds, is not a failure by itself. Mention length only when the opening is much shorter than 40 seconds or much longer than 100. If it walks through jobs in order and the point arrives late, say that on the opening card.

If the candidate used coaching, do not score that answer as fully unassisted, and do not punish them for asking. Notice whether they applied the help. Practice recommendations can reflect repeated help, such as identifying what a question is testing or structuring an answer. Pauses are not a penalty. For practice mode, emphasize what they learned and where they needed support. For a mock interview, describe the performance without coaching. If a mock included a pause, mention that it was not fully unassisted. Set assistanceNote to one or two sentences about that pattern, or an empty string when no coaching was used.

Write at most 4 question cards, covering the main questions. Put clarifying follow-ups on that same card. A new topic is a new card. Return at most 2 strengths, 2 focus areas, and 2 practice recommendations. Each list item is one sentence. exampleImprovedAnswer is at most two sentences.

Classify each main question as star, motivation, structured_reasoning, or direct. Use star only when the question asks for a past experience. For every other framework, set starCoverage to null. For a star question, mark situation, task, action, and result as missing, weak, or clear, and set learning to not_applicable unless the question is about failure, a mistake, conflict, or judgment.

exampleImprovedAnswer may use only the transcript, the resume, a user-confirmed interview story included below, and the professional story. Do not invent a metric, a result, or a lesson. If the result is missing, include the words [result not in the answer]. If learning was required and missing, include [learning not in the answer]. recommendedStory names one saved story that fits, or "Needs a story". One story may fit two competencies. Do not recommend the same story for most of the interview. coachingLine is one sentence of the most useful coaching, or an empty string. It may mention that the result was missing, or that one story was reused too often. Do not add extra scores.

Each score must match its explanation. Use whole numbers.

${rubricAnchors}`;

export function analysisInput(
  config: InterviewConfig,
  blueprint: InterviewBlueprint,
  turns: InterviewTurn[],
  elapsedMs: number,
  assistanceContext = "",
  storyContext = "",
  confirmedStories = "",
): string {
  const openingSeconds = openingAnswerSeconds(turns);
  const openingNote =
    openingSeconds !== null && !openingLengthIsFine(openingSeconds)
      ? `Measured opening answer: about ${Math.round(openingSeconds)} seconds. The useful range is about 45 to 90 seconds. Mention the length because this one is well outside that range. Do not treat 40 or 100 seconds as a failure.`
      : "";
  const competencies = blueprint.competencyPriorities
    .map((item) => `${item.competency} (${item.priority})`)
    .join("; ");
  const topics = blueprint.roleTopicsToProbe.slice(0, 6).join("; ");
  const company =
    blueprint.companyStyle.confidence === "low"
      ? "Company interview style is not reliable enough to judge. Use the job, the level, and the interview type."
      : `Company style confidence: ${blueprint.companyStyle.confidence}
Company style: ${clip(blueprint.companyStyle.summary, 600)}
Behavioral emphasis: ${blueprint.companyStyle.behavioralEmphasis}
Technical emphasis: ${blueprint.companyStyle.technicalEmphasis}`;

  return `Role: ${config.jobTitle}
Company: ${config.company}
Interview type: ${interviewTypeLabel(config.interviewType)}
Candidate level this interview was built for: ${levelLabel(blueprint.candidateLevel)}
Planned difficulty: ${blueprint.overallDifficulty} of 5
${
    blueprint.experienceCalibration
      ? `Experience ceiling: ${blueprint.experienceCalibration.ceilingSummary}
Do not treat missing executive influence, people management, or enterprise strategy as a weakness when those are outside this ceiling. Judge the thinking, communication, and project work this candidate could realistically have done.`
      : ""
  }
Elapsed active time: ${Math.round(elapsedMs / 1000)} seconds
${openingNote}
${assistanceContext}
Competencies: ${competencies || "None listed"}
Role topics: ${topics || "None listed"}
${company}

Job description:
${clip(config.jobDescription, 2500)}

Resume context:
${clip(config.candidate.resumeText, 2500)}
${
  storyContext
    ? `
Saved professional story, for a tell-me-about-yourself or opening answer only. Different wording is fine. Do not penalize them for that. If the answer walks through jobs in order and the theme arrives late or never, say that on the opening question card.
${storyContext}
`
    : ""
}

${
  confirmedStories.trim()
    ? `User-confirmed interview stories. Use these only when the transcript or the story itself supports the point. Do not invent a result or a lesson that is not written here.
${confirmedStories}
`
    : ""
}
Transcript:
${formatTranscript(turns)}`;
}

function formatTranscript(turns: InterviewTurn[]): string {
  const lines = turns.map((turn) => {
    const speaker = turn.speaker === "candidate" ? "Candidate" : "Interviewer";
    return `[${clock(turn.timestampMs)} ${speaker}] ${turn.text}`;
  });
  const text = lines.join("\n");
  if (text.length <= 12000) return text;
  return `${text.slice(0, 6000)}\n[Earlier middle of the interview omitted]\n${text.slice(-5000)}`;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function clip(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[truncated]`;
}
