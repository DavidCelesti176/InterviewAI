import { RequireAuth } from "@/components/auth/require-auth";
import { StoryPractice } from "@/components/story/story-practice";

export default function StoryPracticePage() {
  return (
    <RequireAuth>
      <StoryPractice />
    </RequireAuth>
  );
}
