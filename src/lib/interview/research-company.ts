import OpenAI from "openai";

import { readCompanyProfile, rememberCompanyProfile, writeCompanyProfile } from "@/lib/company/profile-cache";
import { readStoredCompanyProfile, writeStoredCompanyProfile } from "@/lib/company/profile-store";
import type { CompanyInterviewProfile } from "@/lib/interview/types";
import { planModel, planReasoning, planRequestTimeoutMs } from "@/lib/live/config";

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
    answerStructure: { type: "string", enum: ["none", "star", "other"] },
    answerStructureNote: { type: "string" },
    interviewPhilosophy: { type: "string" },
    officialPatterns: { type: "array", items: { type: "string" } },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        sourceType: { type: "string", enum: ["official", "candidate_report", "third_party"] },
        sourceWeight: { type: "string", enum: ["official", "official_prep", "candidate_report", "community"] },
        publishedAt: { type: "string" },
      },
      required: ["title", "url", "sourceType", "sourceWeight", "publishedAt"],
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
      "answerStructure",
      "answerStructureNote",
      "interviewPhilosophy",
      "officialPatterns",
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
    answerStructure: "none",
    answerStructureNote: "",
    interviewPhilosophy: "",
    officialPatterns: [],
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

export function unavailableCompanyProfile(company: string): CompanyInterviewProfile {
  return emptyProfile(company, "Company research was unavailable, so this interview relies on the role and resume.");
}

async function researchProfile(company: string, jobTitle: string): Promise<CompanyInterviewProfile> {
  const client = new OpenAI({ maxRetries: 0, timeout: planRequestTimeoutMs });
  const response = await client.responses.create({
    model: planModel(),
    reasoning: planReasoning,
    tools: [{ type: "web_search", search_context_size: "low" }],
    include: ["web_search_call.action.sources"],
    instructions:
      "Research how this company interviews candidates, then return one cautious profile. Weigh sources in this order: official careers or interview pages, official recruiting documents, company-published candidate preparation, recent consistent candidate reports, then community anecdotes. Official material outweighs one anecdote. If the employer publishes sample questions, STAR guidance, or preparation tips, summarize the pattern, the competencies, and the preferred answer structure. Do not copy sample questions word for word. Put those patterns in officialPatterns, not as a script. If nothing official is found, leave answerStructure as none, keep confidence low, and do not invent a company ritual. Use unknown when evidence is missing. Only include source URLs that this search actually opened. Use an empty string when a date is unknown. Return at most 5 patterns, 5 official patterns, 5 competencies, 4 process notes, and 6 sources.",
    input: `Company: ${company}
Role being prepared: ${jobTitle}

Find credible evidence about the interview process, format, behavioral versus technical versus case emphasis, structured competencies, and recent candidate reports.`,
    text: {
      format: {
        type: "json_schema",
        name: "company_interview_profile",
        strict: true,
        schema: profileSchema,
      },
    },
  });
  const notes: ResearchNotes = {
    notes: response.output_text?.trim() ?? "",
    urls: collectUrls(response),
  };
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
    officialPatterns: Array.isArray(parsed.officialPatterns) ? parsed.officialPatterns.slice(0, 5) : [],
    sources: sources.filter((source) => source?.url && allowed.has(source.url)).slice(0, 6),
  };
}

export async function researchCompany(
  company: string,
  jobTitle: string,
): Promise<{ profile: CompanyInterviewProfile; cacheHit: boolean }> {
  const cached = readCompanyProfile(company);
  if (cached) return cached;
  const stored = await readStoredCompanyProfile(company);
  if (stored) {
    rememberCompanyProfile(stored.profile, stored.expiresAt);
    return { profile: stored.profile, cacheHit: true };
  }

  try {
    const profile = await researchProfile(company, jobTitle);
    if (!profile.summary.trim()) {
      return { profile: emptyProfile(company, "No reliable public interview guidance was found."), cacheHit: false };
    }
    writeCompanyProfile(profile);
    try {
      await writeStoredCompanyProfile(profile);
    } catch (error) {
      console.error("Company profile cache write failed", error instanceof Error ? error.message : "error");
    }
    return { profile, cacheHit: false };
  } catch (error) {
    console.error("Company research failed", error instanceof Error ? `${error.name}: ${error.message}` : "error");
    return { profile: unavailableCompanyProfile(company), cacheHit: false };
  }
}
