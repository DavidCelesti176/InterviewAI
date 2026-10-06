import OpenAI from "openai";

import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { markInterviewStarted } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { buildPracticeInstructions } from "@/lib/interview/practice-prompt";
import { buildInterviewerInstructions } from "@/lib/interview/prompt";
import { getInterview } from "@/lib/interview/store";
import { interviewerName, liveSessionSettings } from "@/lib/live/config";
import { readProfessionalStory } from "@/lib/firebase/data";
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
  } catch {
    return jsonError("An SDP offer is required", 400);
  }

  if (!sdp.trim()) {
    return jsonError("An SDP offer is required", 400);
  }
  if (!sdp.endsWith("\n")) {
    sdp += "\r\n";
  }

  if (!storyPractice && !interviewId) {
    return jsonError("Create an interview before starting.", 400);
  }
  const interview = storyPractice ? null : await getInterview(user.uid, interviewId);
  if (!storyPractice && !interview) {
    return jsonError("This interview could not be found.", 404);
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError("Set OPENAI_API_KEY on the server", 503);
  }

  const { model, voice } = liveSessionSettings(interviewerId);
  const name = interviewerName(interviewerId);
  const client = new OpenAI({ maxRetries: 0 });
  let instructions = "";
  if (storyPractice) {
    const story = await readProfessionalStory(user.uid);
    if (!story) return jsonError("Build your story before practicing it.", 400);
    instructions = buildStoryPracticeInstructions(story, name);
  } else if (interview?.practice) {
    instructions = buildPracticeInstructions(interview.config, interview.blueprint, interview.practice, name);
  } else if (interview) {
    instructions = buildInterviewerInstructions(interview.config, interview.blueprint, name, interview.storyContext ?? "");
  }
  if (!instructions) return jsonError("This interview could not be found.", 404);

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
