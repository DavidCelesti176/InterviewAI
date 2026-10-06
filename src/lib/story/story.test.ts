import assert from "node:assert/strict";
import test from "node:test";

import { buildStoryPracticeInstructions, storyFeedbackInstructions } from "./practice-prompt";
import { evidenceIsGrounded, groundedAnalysis, preserveCore, storyFromUnknown } from "./story";
import type { ProfessionalStory, StoryAnalysis } from "./types";

const mixedResume = `
David Celesti
ServiceWizard — built a software product from problems running a service business.
Prasco internship — built reporting and planning tools for business processes.
Coldstream — ran a service business and improved the operating routine.
`;

const internshipResume = `
Campus marketing internship at Northline, summer 2025.
Helped the team organize a weekly campaign report for a supervisor.
Class project: surveyed 20 students about a campus app.
`;

const schoolResume = `
University of Example
Capstone: designed a scheduling tool for a student club.
Coursework in statistics and operations.
`;

const scatteredResume = `
Barista, campus cafe, 2024.
Intramural soccer captain.
Intro to Python course project: a grade calculator.
Volunteer weekend move-in crew.
`;

function analysis(options: StoryAnalysis["identityOptions"]): StoryAnalysis {
  return {
    identityOptions: options,
    recurringPatterns: ["A pattern throughout my experiences has been building practical tools."],
    suggestedEvidence: [],
    note: "",
  };
}

const saved: ProfessionalStory = {
  identity: { label: "Builder", statement: "You tend to see something that could work better and build the solution." },
  pattern: "A pattern throughout my experiences has been seeing something that could work better and wanting to build the solution.",
  evidence: [
    { title: "ServiceWizard", sourceExperience: "ServiceWizard", proof: "Built a product from a problem you experienced directly." },
    { title: "Prasco", sourceExperience: "Prasco", proof: "Built reporting tools around unclear business needs." },
  ],
  direction: "I like working where business and operations meet.",
  generalTellMeAboutYourself: "I tend to build the thing that would make the work clearer.",
  shortTellMeAboutYourself: "I build practical tools when the work is unclear.",
  memorability: "David is the builder who turns messy business problems into practical tools.",
  resumeId: "resume-1",
  createdAt: 1,
  updatedAt: 2,
};

test("entrepreneurial and internship evidence both stay when they are on the resume", () => {
  const result = groundedAnalysis(
    mixedResume,
    analysis([
      {
        id: "builder",
        label: "Builder",
        statement: "You tend to build the tool the work is missing.",
        explanation: "Two different settings.",
        confidence: "high",
        evidence: [
          { experience: "ServiceWizard", evidence: "Built a product from running the business." },
          { experience: "Prasco", evidence: "Built reporting tools." },
          { experience: "NASA leadership", evidence: "Led a national program." },
        ],
      },
    ]),
  );
  assert.equal(result.identityOptions.length, 1);
  assert.deepEqual(
    result.identityOptions[0]?.evidence.map((item) => item.experience),
    ["ServiceWizard", "Prasco"],
  );
});

test("internship resumes do not keep authority the resume never names", () => {
  assert.equal(evidenceIsGrounded(internshipResume, "Northline"), true);
  assert.equal(evidenceIsGrounded(internshipResume, "Regional Director"), false);
  const result = groundedAnalysis(
    internshipResume,
    analysis([
      {
        id: "organizer",
        label: "Organizer",
        statement: "You tend to make a messy weekly process easier to follow.",
        explanation: "The internship is the main proof.",
        confidence: "medium",
        evidence: [
          { experience: "Northline", evidence: "Organized a weekly campaign report." },
          { experience: "Regional Director", evidence: "Ran a department." },
        ],
      },
    ]),
  );
  assert.deepEqual(result.identityOptions[0]?.evidence.map((item) => item.experience), ["Northline"]);
});

test("school and project evidence can carry a theme", () => {
  assert.equal(evidenceIsGrounded(schoolResume, "Capstone"), true);
  assert.equal(evidenceIsGrounded(schoolResume, "Fortune strategy office"), false);
});

test("scattered resumes can keep more than one grounded theme", () => {
  const result = groundedAnalysis(
    scatteredResume,
    analysis([
      {
        id: "learner",
        label: "Learner",
        statement: "You keep picking up a new skill and trying it on a small project.",
        explanation: "Thin, mostly the course project.",
        confidence: "low",
        evidence: [{ experience: "Python", evidence: "Built a grade calculator in a course." }],
      },
      {
        id: "connector",
        label: "Connector",
        statement: "You show up in group settings and take a practical role.",
        explanation: "Cafe, soccer, and move-in are different settings.",
        confidence: "low",
        evidence: [
          { experience: "soccer", evidence: "Captain of an intramural team." },
          { experience: "cafe", evidence: "Worked a campus cafe shift." },
        ],
      },
      {
        id: "executive",
        label: "Strategist",
        statement: "You set enterprise strategy.",
        explanation: "Not on the resume.",
        confidence: "low",
        evidence: [{ experience: "McKinsey", evidence: "Advised the CEO." }],
      },
    ]),
  );
  assert.deepEqual(
    result.identityOptions.map((item) => item.label),
    ["Learner", "Connector"],
  );
});

test("a different job changes direction and leaves the identity alone", () => {
  const sales = preserveCore(saved, {
    evidence: saved.evidence,
    direction: "I’m especially interested in using data to find business opportunities.",
    tellMeAboutYourself: "Sales version",
    memorability: "The builder who looks for practical commercial tools.",
  });
  const analyst = preserveCore(saved, {
    evidence: [saved.evidence[1], saved.evidence[0]],
    direction: "I’m especially interested in improving the process behind a decision.",
    tellMeAboutYourself: "Analyst version",
    memorability: "The builder who improves how a process works.",
  });
  assert.equal(sales.identity.label, "Builder");
  assert.equal(analyst.identity.label, sales.identity.label);
  assert.equal(analyst.pattern, sales.pattern);
  assert.notEqual(sales.direction, analyst.direction);
  assert.equal(analyst.evidence[0]?.sourceExperience, "Prasco");
});

test("an edited identity statement is what gets saved", () => {
  const edited = storyFromUnknown({
    ...saved,
    identity: { label: "Maker", statement: "I notice a clunky process and I want to rebuild it." },
  });
  assert.equal(edited?.identity.label, "Maker");
  assert.equal(edited?.identity.statement, "I notice a clunky process and I want to rebuild it.");
});

test("voice practice coaches structure and does not require a script", () => {
  const prompt = buildStoryPracticeInstructions(saved);
  assert.match(prompt, /Do not ask them to match a script/);
  assert.match(storyFeedbackInstructions, /Do not ask them to memorize a script/);
  assert.match(prompt, /Tell me a little about yourself/);
});
