import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { getResume, isRecordId, saveResumeFile } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { MAX_PDF_BYTES, MAX_RESUME_TEXT_CHARS, MIN_RESUME_TEXT_CHARS, clipText } from "@/lib/interview/limits";
import { extractPdfText, looksLikePdf } from "@/lib/resume/parse-pdf";
import { analyzeResumeStory } from "@/lib/story/analyze";

export const runtime = "nodejs";
export const maxDuration = 30;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Unexpected request origin", 403);
  if (!process.env.OPENAI_API_KEY) return jsonError("Set OPENAI_API_KEY on the server", 503);
  const user = await authenticate(request);
  if (!isUser(user)) return user;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("The resume could not be read.", 400);
  }

  const resumeIdField = form.get("resumeId");
  const requestedId = typeof resumeIdField === "string" ? resumeIdField.trim() : "";
  let resumeId = "";
  let resumeFileName = "";
  let resumeText = "";

  if (requestedId) {
    if (!isRecordId(requestedId)) return jsonError("That saved resume could not be found.", 404);
    const saved = await getResume(user.uid, requestedId);
    if (!saved) return jsonError("That saved resume could not be found.", 404);
    resumeId = requestedId;
    resumeFileName = saved.originalFileName;
    resumeText = saved.parsedText;
  } else {
    const resume = form.get("resume");
    if (!(resume instanceof File) || resume.size === 0) return jsonError("Choose a resume to build from.", 400);
    const pdfName = resume.name.toLowerCase().endsWith(".pdf");
    if ((!pdfName && resume.type !== "application/pdf") || resume.size > MAX_PDF_BYTES) {
      return jsonError("Upload a PDF resume under 8 MB.", 400);
    }
    const bytes = new Uint8Array(await resume.arrayBuffer());
    if (!looksLikePdf(bytes)) return jsonError("Upload a PDF resume.", 400);
    try {
      resumeText = await extractPdfText(bytes);
    } catch (error) {
      console.error("Story resume parse failed", error instanceof Error ? error.name : "error");
      return jsonError("We could not read that PDF. Export it as a text-based PDF and try again.", 400);
    }
    if (resumeText.length < MIN_RESUME_TEXT_CHARS) {
      return jsonError("We could not read enough text from that PDF.", 400);
    }
    try {
      const uploaded = await saveResumeFile({
        uid: user.uid,
        fileName: resume.name,
        bytes,
        parsedText: clipText(resumeText, MAX_RESUME_TEXT_CHARS),
      });
      resumeId = uploaded.id;
      resumeFileName = uploaded.originalFileName;
    } catch (error) {
      console.error("Story resume save failed", error instanceof Error ? error.message : "error");
      return jsonError("The resume could not be saved. Try again.", 502);
    }
  }

  if (resumeText.length < MIN_RESUME_TEXT_CHARS) {
    return jsonError("That resume does not have enough text to find a pattern.", 400);
  }

  try {
    const analysis = await analyzeResumeStory(resumeText);
    return Response.json({ resumeId, resumeFileName, analysis });
  } catch (error) {
    console.error("Story analysis failed", error instanceof Error ? error.message : "error");
    const timedOut = error instanceof Error && /timeout|timed out/i.test(error.message);
    return jsonError(timedOut ? "Reading the resume took too long. Try again." : "The resume could not be read for a story yet.", 502);
  }
}
