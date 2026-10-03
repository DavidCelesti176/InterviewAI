import OpenAI from "openai";

import { readCompanyProfile, writeCompanyProfile } from "@/lib/company/profile-cache";
import type { CompanyInterviewProfile } from "@/lib/interview/types";
import { planModel, planReasoning } from "@/lib/live/config";

const profileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    summary: { type: "string" },
    officialEvidenceFound: { type: "boolean" },
    behavioralEmphasis: { type: "string", enum: ["low", "medium", "high", "unknown"] },
    technicalEmphasis: { type: "string", enum: ["low", "medium", "high", "role_dependent", "unknown"] },
    caseInterviewEmphasis: { type: "string", enum: ["low", "medium", "high", "role_dependent", "unknown"] },
    structuredInterviewLikelihood: { type: "string", enum: ["low", "medium", "high", "unknown"] },
    commonQuestionPatterns: { type: "array", items: { type: "string" } },
    commonCompetencies: { type: "array", items: { type: "string" } },
    interviewerToneGuidance: { type: "string" },
    followUpStyle: { type: "string" },
    processNotes: { type: "array", items: { type: "string" } },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          sourceType: { type: "string", enum: ["official", "candidate_report", "third_party"] },
          publishedAt: { type: "string" },
        },
        required: ["title", "url", "sourceType", "publishedAt"],
      },
    },
  },
  required: [
    "confidence",
    "summary",
    "officialEvidenceFound",
    "behavioralEmphasis",
    "technicalEmphasis",
    "caseInterviewEmphasis",
    "structuredInterviewLikelihood",
    "commonQuestionPatterns",
    "commonCompetencies",
    "interviewerToneGuidance",
    "followUpStyle",
    "processNotes",
    "sources",
  ],
} as const;

type ResearchNotes = {
  notes: string;
  urls: string[];
};

function emptyProfile(company: string, summary: string): CompanyInterviewProfile {
  return {
    company,
    confidence: "low",
    researchedAt: new Date().toISOString(),
    summary,
    officialEvidenceFound: false,
    behavioralEmphasis: "unknown",
    technicalEmphasis: "unknown",
    caseInterviewEmphasis: "unknown",
    structuredInterviewLikelihood: "unknown",
    commonQuestionPatterns: [],
    commonCompetencies: [],
    interviewerToneGuidance: "",
    followUpStyle: "",
    processNotes: [],
    sources: [],
  };
}

function collectUrls(response: OpenAI.Responses.Response): string[] {
  const urls = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.startsWith("http")) urls.add(value);
  };
  for (const item of response.output ?? []) {
    if (item.type === "web_search_call") {
      const action = item.action;
      if (action?.type === "search" && Array.isArray(action.sources)) {
        for (const source of action.sources) add(source?.url);
      }
      if (action?.type === "open_page") add(action.url);
    }
    if (item.type === "message") {
      for (const part of item.content) {
        if (part.type !== "output_text" || !Array.isArray(part.annotations)) continue;
        for (const annotation of part.annotations) {
          if (annotation.type === "url_citation") add(annotation.url);
        }
      }
    }
  }
  return [...urls].slice(0, 8);
}

async function searchCompany(company: string, jobTitle: string): Promise<ResearchNotes> {
  const client = new OpenAI({ maxRetries: 0 });
  const response = await client.responses.create({
    model: planModel(),
    reasoning: planReasoning,
    tools: [{ type: "web_search", search_context_size: "low" }],
    include: ["web_search_call.action.sources"],
    instructions:
      "Research how this company interviews candidates. Prefer official careers pages, official interview-preparation pages, and official campus-recruiting material. Then recent consistent candidate reports. Treat one anecdote as weak. Do not invent a process, a question, or a date. If evidence is thin or conflicting, say so. Note whether a pattern is company-wide or role-specific.",
    input: `Company: ${company}
Role being prepared: ${jobTitle}

Find credible evidence about the interview process, format, behavioral versus technical versus case emphasis, structured competencies, and recent candidate reports. Distinguish official guidance from anecdotal reports.`,
  });
  return {
    notes: response.output_text?.trim() ?? "",
    urls: collectUrls(response),
  };
}

async function structureProfile(company: string, notes: ResearchNotes): Promise<CompanyInterviewProfile> {
  const client = new OpenAI({ maxRetries: 0 });
  const response = await client.responses.create({
    model: planModel(),
    reasoning: planReasoning,
    instructions:
      "Turn research notes into a cautious company interview profile. Official sources outweigh candidate reports. Recent reports outweigh old ones. Use unknown when evidence is missing. Use low confidence when evidence is thin, conflicting, or only anecdotal. Do not claim the company always asks something. Only include source URLs that appear in the supplied URL list. Use an empty string when a date is unknown. Return at most 5 patterns, 5 competencies, 4 process notes, and 6 sources.",
    input: `Company: ${company}

Research notes:
${notes.notes || "No research notes were returned."}

Source URLs:
${notes.urls.join("\n") || "None"}`,
    text: {
      format: {
        type: "json_schema",
        name: "company_interview_profile",
        strict: true,
        schema: profileSchema,
      },
    },
  });
  const parsed = JSON.parse(response.output_text) as Omit<CompanyInterviewProfile, "company" | "researchedAt">;
  const allowed = new Set(notes.urls);
  const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
  return {
    ...parsed,
    company,
    researchedAt: new Date().toISOString(),
    commonQuestionPatterns: Array.isArray(parsed.commonQuestionPatterns) ? parsed.commonQuestionPatterns.slice(0, 5) : [],
    commonCompetencies: Array.isArray(parsed.commonCompetencies) ? parsed.commonCompetencies.slice(0, 5) : [],
    processNotes: Array.isArray(parsed.processNotes) ? parsed.processNotes.slice(0, 4) : [],
    sources: sources.filter((source) => source?.url && allowed.has(source.url)).slice(0, 6),
  };
}

export async function researchCompany(
  company: string,
  jobTitle: string,
): Promise<{ profile: CompanyInterviewProfile; cacheHit: boolean }> {
  const cached = readCompanyProfile(company);
  if (cached) return cached;

  try {
    const notes = await searchCompany(company, jobTitle);
    if (!notes.notes && notes.urls.length === 0) {
      return { profile: emptyProfile(company, "No reliable public interview guidance was found."), cacheHit: false };
    }
    const profile = await structureProfile(company, notes);
    if (!profile.summary.trim()) {
      return { profile: emptyProfile(company, "No reliable public interview guidance was found."), cacheHit: false };
    }
    writeCompanyProfile(profile);
    return { profile, cacheHit: false };
  } catch (error) {
    console.error("Company research failed", error instanceof Error ? `${error.name}: ${error.message}` : "error");
    return {
      profile: emptyProfile(company, "Company research was unavailable, so this interview relies on the role and resume."),
      cacheHit: false,
    };
  }
}
