import OpenAI from "openai";

import { clipText, MAX_COMPANY_CHARS, MAX_JOB_DESCRIPTION_CHARS, MAX_JOB_TITLE_CHARS } from "@/lib/interview/limits";
import { analysisModel, planReasoning } from "@/lib/live/config";

export type ExtractedJob = {
  company: string;
  jobTitle: string;
  jobDescription: string;
};

const jobListingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    company: { type: "string" },
    jobTitle: { type: "string" },
    jobDescription: { type: "string" },
  },
  required: ["company", "jobTitle", "jobDescription"],
} as const;

function isExtracted(value: unknown): value is ExtractedJob {
  if (!value || typeof value !== "object") return false;
  const job = value as ExtractedJob;
  return typeof job.company === "string" && typeof job.jobTitle === "string" && typeof job.jobDescription === "string";
}

export async function extractJobListing(listing: string): Promise<ExtractedJob> {
  const client = new OpenAI({ maxRetries: 0 });
  const response = await client.responses.create({
    model: analysisModel(),
    reasoning: planReasoning,
    instructions:
      "Extract the employer, job title, and job description from a pasted job listing. Copy names as written. If the company or title is not in the listing, return an empty string. Do not invent either one. The job description should keep the responsibilities, requirements, and qualifications, and drop application instructions, legal boilerplate, and site navigation. Do not summarize the role down to a sentence.",
    input: listing,
    text: {
      format: {
        type: "json_schema",
        name: "job_listing",
        strict: true,
        schema: jobListingSchema,
      },
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    throw new Error("Job listing was not valid JSON");
  }
  if (!isExtracted(parsed)) {
    throw new Error("Job listing did not match the expected shape");
  }
  return {
    company: clipText(parsed.company, MAX_COMPANY_CHARS),
    jobTitle: clipText(parsed.jobTitle, MAX_JOB_TITLE_CHARS),
    jobDescription: clipText(parsed.jobDescription, MAX_JOB_DESCRIPTION_CHARS),
  };
}
