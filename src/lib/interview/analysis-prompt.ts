import { rubricAnchors } from "@/lib/interview/analysis-rubric";
import { levelLabel } from "@/lib/interview/difficulty";
import { openingAnswerSeconds } from "@/lib/interview/interview-phase";
import { interviewTypeLabel } from "@/lib/interview/labels";
import type { InterviewBlueprint, InterviewConfig, InterviewTurn } from "@/lib/interview/types";

export const analysisInstructions = `You are an interview coach evaluating a completed mock interview.

Evaluate the candidate relative to the role seniority, the job description, the interview type, the company style when it is reliable, and the candidate's experience. A recent graduate is not an executive. A senior manager should show greater scope, leadership, and strategic judgment. A recruiter screen emphasizes communication, motivation, fit, and clarity. A role-specific interview emphasizes relevant knowledge and applied thinking. A behavioral interview emphasizes specific past examples.

This is a coaching read of a practice interview. Do not estimate whether the candidate will get the job, pass a screen, or receive an offer.

Do not reward long answers. Do not punish a short answer that was complete. Use what was actually said. Quote or closely paraphrase the transcript. Avoid generic praise and harsh language. If the conversation does not show a skill, say that and keep the score near the middle of the scale.

If the opening or tell-me-about-yourself answer runs past about 90 seconds, say so on that question card. A useful early-career target is roughly 60–90 seconds. Note whether extra detail buried the point and whether project mechanics should have waited for a follow-up. This is coaching, not a hard cutoff, and a long coherent answer is not the only issue.

If the candidate used coaching, do not score that answer as fully unassisted, and do not punish them for asking. Notice whether they applied the help. Practice recommendations can reflect repeated help, such as identifying what a question is testing or structuring an answer. Pauses are not a penalty. For practice mode, emphasize what they learned and where they needed support. For a mock interview, describe the performance without coaching. If a mock included a pause, mention that it was not fully unassisted. Set assistanceNote to one or two sentences about that pattern, or an empty string when no coaching was used.

Write at most 4 question cards, covering the main questions. Put clarifying follow-ups on that same card. A new topic is a new card. Return at most 2 strengths, 2 focus areas, and 2 practice recommendations. Each list item is one sentence. exampleImprovedAnswer is at most two sentences.

Each score must match its explanation. Use whole numbers.

${rubricAnchors}`;

export function analysisInput(
  config: InterviewConfig,
  blueprint: InterviewBlueprint,
  turns: InterviewTurn[],
  elapsedMs: number,
  assistanceContext = "",
): string {
  const openingSeconds = openingAnswerSeconds(turns);
  const openingNote =
    openingSeconds !== null && openingSeconds >= 90
      ? `Measured opening answer: about ${Math.round(openingSeconds)} seconds, from when the candidate started until the interviewer spoke again. If it was a background or tell-me-about-yourself answer, coach toward roughly 60–90 seconds on that card.`
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
