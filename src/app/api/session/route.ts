import OpenAI from "openai";

import { abortLive, commitLive, lockReservation } from "@/lib/billing/store";
import { entitlementResponse } from "@/lib/billing/http";
import { billingBypassEnabled, liveCreateShouldFail } from "@/lib/billing/enforcement";
import { safetyCeilingMinutes } from "@/lib/billing/products";
import type { SessionGrant } from "@/lib/billing/types";
import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { markInterviewStarted, readProfessionalStory } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { buildPracticeInstructions } from "@/lib/interview/practice-prompt";
import { buildInterviewerInstructions } from "@/lib/interview/prompt";
import { getInterview } from "@/lib/interview/store";
import type { InterviewConfig } from "@/lib/interview/types";
import { interviewerName, liveSessionSettings } from "@/lib/live/config";
import { buildStoryPracticeInstructions } from "@/lib/story/practice-prompt";

export const runtime = "nodejs";

const MAX_BODY_CHARS = 64 * 1024;

const allowedClientEvents = [
  "session.instructions.append",
  "session.thinking.append",
  "session.input_audio.mute",
  "session.input_audio.unmute",
  "session.close",
];

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError("Unexpected request origin", 403);
  }
  const user = await authenticate(request);
  if (!isUser(user)) return user;

  const raw = await request.text();
  if (!raw.trim() || raw.length > MAX_BODY_CHARS) {
    return jsonError("An SDP offer is required", 400);
  }

  let sdp = "";
  let interviewId = "";
  let interviewerId = "";
  let storyPractice = false;
  let sessionId = "";
  let reservationId = "";
  try {
    const body: unknown = JSON.parse(raw);
    if (body && typeof body === "object" && "sdp" in body && typeof body.sdp === "string") {
      sdp = body.sdp;
    }
    if (body && typeof body === "object" && "interviewId" in body && typeof body.interviewId === "string") {
      interviewId = body.interviewId.trim();
    }
    if (body && typeof body === "object" && "interviewerId" in body && typeof body.interviewerId === "string") {
      interviewerId = body.interviewerId.trim();
    }
    if (body && typeof body === "object" && "storyPractice" in body && body.storyPractice === true) {
      storyPractice = true;
    }
    if (body && typeof body === "object" && "sessionId" in body && typeof body.sessionId === "string") {
      sessionId = body.sessionId.trim();
    }
    if (body && typeof body === "object" && "reservationId" in body && typeof body.reservationId === "string") {
      reservationId = body.reservationId.trim();
    }
  } catch {
    return jsonError("An SDP offer is required", 400);
  }

  if (!sdp.trim()) {
    return jsonError("An SDP offer is required", 400);
  }
  if (!sdp.endsWith("\n")) {
    sdp += "\r\n";
  }

  const bypass = billingBypassEnabled();
  let grant: SessionGrant | null = null;
  if (!bypass) {
    if (!sessionId || !reservationId) return entitlementResponse("PAYMENT_REQUIRED");
    grant = await lockReservation(user.uid, reservationId, sessionId);
    if (!grant) return entitlementResponse("CREDIT_RESERVED");
    storyPractice = grant.practiceKind === "story";
    interviewId = grant.interviewId ?? "";
  }
  if (!storyPractice && !interviewId) {
    return jsonError("Create an interview before starting.", 400);
  }
  const interview = storyPractice ? null : await getInterview(user.uid, interviewId);
  if (!storyPractice && !interview) {
    if (grant) await abortLive(user.uid, reservationId);
    return jsonError("This interview could not be found.", 404);
  }

  if (!process.env.OPENAI_API_KEY) {
    if (grant) await abortLive(user.uid, reservationId);
    return jsonError("Set OPENAI_API_KEY on the server", 503);
  }

  const { model, voice } = liveSessionSettings(interviewerId);
  const name = interviewerName(interviewerId);
  const client = new OpenAI({ maxRetries: 0 });
  let instructions = "";
  if (storyPractice) {
    const story = await readProfessionalStory(user.uid);
    if (!story) {
      if (grant) await abortLive(user.uid, reservationId);
      return jsonError("Build your story before practicing it.", 400);
    }
    instructions = `${buildStoryPracticeInstructions(story, name)}\n${capLine(grant)}`;
  } else if (grant?.sessionClass === "voice_practice" && interview?.practice) {
    instructions = `${buildPracticeInstructions(pacedConfig(interview.config, grant), interview.blueprint, interview.practice, name)}\n${capLine(grant)}`;
  } else if (interview) {
    instructions = `${buildInterviewerInstructions(pacedConfig(interview.config, grant), interview.blueprint, name, interview.storyContext ?? "")}\n${capLine(grant)}`;
  }
  if (!instructions) {
    if (grant) await abortLive(user.uid, reservationId);
    return jsonError("This interview could not be found.", 404);
  }

  try {
    if (liveCreateShouldFail()) throw new Error("dev-live-create-fail");
    const result = await client.live.create({
      session: {
        model,
        instructions,
        delegation: { type: "client" },
        audio: { output: { voice } },
        store: false,
        client: {
          data_channel: {
            allowed_client_events: allowedClientEvents,
          },
        },
      },
      transport: {
        type: "webrtc",
        sdp,
      },
    });

    if (grant) {
      const committed = await commitLive(user.uid, reservationId, result.session.id);
      if (!committed) {
        await abortLive(user.uid, reservationId);
        return entitlementResponse("CREDIT_RESERVED");
      }
    }
    if (!storyPractice) {
      try {
        await markInterviewStarted(user.uid, interviewId, interviewerId);
      } catch (saveError) {
        console.error("Interview start save failed", saveError instanceof Error ? saveError.message : "error");
      }
    }

    return Response.json(
      {
        session: { id: result.session.id },
        transport: { type: result.transport.type, sdp: result.transport.sdp },
      },
      { status: 201 },
    );
  } catch (error) {
    if (grant) await abortLive(user.uid, reservationId);
    if (error instanceof OpenAI.APIError) {
      console.error(
        "Live session creation failed",
        error.status,
        error.code ?? "",
        error.param ?? "",
        error.message,
      );
      if (error.status === 403) {
        return jsonError(
          "Voice session access denied. This project's API key is not allowed to create GPT-Live sessions.",
          403,
        );
      }
      return jsonError("Live session creation failed", error.status ?? 502);
    }
    console.error("Live session creation failed");
    return jsonError("Live session creation failed", 502);
  }
}

function pacedConfig(config: InterviewConfig, grant: SessionGrant | null): InterviewConfig {
  if (!grant) return config;
  return { ...config, targetDurationMinutes: grant.targetMinutes };
}

function capLine(grant: SessionGrant | null): string {
  if (!grant) return "";
  const ceiling = safetyCeilingMinutes(grant);
  return `Aim for about ${grant.targetMinutes} minutes and wrap up naturally. Do not keep the conversation going past ${ceiling} minutes.`;
}
