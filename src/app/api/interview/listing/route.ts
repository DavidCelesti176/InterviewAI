import OpenAI from "openai";

import { isSameOrigin } from "@/lib/http/same-origin";
import { extractJobListing } from "@/lib/interview/listing";
import { MAX_JOB_LISTING_CHARS, MIN_JOB_LISTING_CHARS } from "@/lib/interview/limits";

export const runtime = "nodejs";

const MAX_BODY_CHARS = MAX_JOB_LISTING_CHARS + 1024;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError("Unexpected request origin", 403);
  }
  if (!process.env.OPENAI_API_KEY) {
    return jsonError("Set OPENAI_API_KEY on the server", 503);
  }

  const raw = await request.text();
  if (!raw.trim()) {
    return jsonError("Paste a job listing first.", 400);
  }
  if (raw.length > MAX_BODY_CHARS) {
    return jsonError("That job listing is too long.", 400);
  }

  let listing = "";
  try {
    const body: unknown = JSON.parse(raw);
    if (body && typeof body === "object" && "listing" in body && typeof body.listing === "string") {
      listing = body.listing.trim();
    }
  } catch {
    return jsonError("Paste a job listing first.", 400);
  }

  if (listing.length < MIN_JOB_LISTING_CHARS) {
    return jsonError("Paste a job listing first.", 400);
  }
  if (listing.length > MAX_JOB_LISTING_CHARS) {
    return jsonError("That job listing is too long.", 400);
  }

  try {
    const job = await extractJobListing(listing);
    return Response.json(job);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("Job listing extract failed", error.status, error.code ?? "", error.message);
    } else {
      console.error("Job listing extract failed", error instanceof Error ? error.message : "error");
    }
    return jsonError("We couldn't read that listing. Paste the full posting and try again.", 502);
  }
}
