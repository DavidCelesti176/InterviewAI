import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { readProfessionalStory } from "@/lib/firebase/data";
import { getInterview } from "@/lib/interview/store";
import { createInterviewStory, listInterviewStories } from "@/lib/interview/story-store";
import { prepChecklist, readinessFor, type InterviewStory } from "@/lib/interview/stories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const stories = await listInterviewStories(user.uid);
  const interviewId = new URL(request.url).searchParams.get("interviewId");
  const checklist = await checklistFor(user.uid, interviewId, stories.length);
  const competencies = [...new Set(stories.flatMap((story) => story.competencies))];
  return Response.json({
    stories,
    readiness: competencies.map((competencyId) => ({ competencyId, state: readinessFor(stories, competencyId) })),
    checklist,
  });
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const body = await request.json().catch(() => null);
  const saved = await createInterviewStory(user.uid, body);
  if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json({ story: saved });
}

async function checklistFor(uid: string, interviewId: string | null, storyCount: number) {
  const professional = await readProfessionalStory(uid).catch(() => null);
  let companyResearched = false;
  let roleUnderstood = false;
  let resumeReviewed = false;
  if (interviewId) {
    const interview = await getInterview(uid, interviewId).catch(() => null);
    if (interview) {
      const profile = interview.debug?.companyProfile;
      companyResearched = profile?.confidence !== "low" && Boolean(profile?.summary?.trim());
      roleUnderstood = Boolean(interview.config.jobTitle.trim());
      resumeReviewed = interview.config.candidate.resumeText.trim().length > 40;
    }
  }
  return prepChecklist({
    companyResearched,
    roleUnderstood,
    resumeReviewed,
    tellMeAboutYourself: Boolean(professional?.shortTellMeAboutYourself.trim()),
    storyCount,
  });
}

export type StoryListResponse = {
  stories: InterviewStory[];
  readiness: Array<{ competencyId: string; state: string }>;
  checklist: Array<{ id: string; label: string; done: boolean }>;
};
