import { RequireAuth } from "@/components/auth/require-auth";
import { InterviewStories } from "@/components/interview/interview-stories";

export default function InterviewStoriesPage() {
  return (
    <RequireAuth>
      <InterviewStories />
    </RequireAuth>
  );
}
