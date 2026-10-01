import OpenAI from "openai";

import { isSameOrigin } from "@/lib/http/same-origin";
import { buildPracticeInstructions } from "@/lib/interview/practice-prompt";
import { buildInterviewerInstructions } from "@/lib/interview/prompt";
import { getInterview } from "@/lib/interview/store";
import { liveSessionSettings } from "@/lib/live/config";

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

  const raw = await request.text();
  if (!raw.trim() || raw.length > MAX_BODY_CHARS) {
    return jsonError("An SDP offer is required", 400);
  }

  let sdp = "";
  let interviewId = "";
  try {
    const body: unknown = JSON.parse(raw);
    if (body && typeof body === "object" && "sdp" in body && typeof body.sdp === "string") {
      sdp = body.sdp;
    }
    if (body && typeof body === "object" && "interviewId" in body && typeof body.interviewId === "string") {
      interviewId = body.interviewId.trim();
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

  if (!interviewId) {
    return jsonError("Create an interview before starting.", 400);
  }
  const interview = await getInterview(interviewId);
  if (!interview) {
    return jsonError("This interview setup expired. Create it again.", 404);
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError("Set OPENAI_API_KEY on the server", 503);
  }

  const { model, voice } = liveSessionSettings();
  const client = new OpenAI({ maxRetries: 0 });
  const instructions = interview.practice
    ? buildPracticeInstructions(interview.config, interview.blueprint, interview.practice)
    : buildInterviewerInstructions(interview.config, interview.blueprint);

  try {
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

    return Response.json(
      {
        session: { id: result.session.id },
        transport: { type: result.transport.type, sdp: result.transport.sdp },
      },
      { status: 201 },
    );
  } catch (error) {
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
