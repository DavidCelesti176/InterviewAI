import { RequireAuth } from "@/components/auth/require-auth";
import { StoryBuilder } from "@/components/story/story-builder";

export default function StoryBuilderPage() {
  return (
    <RequireAuth>
      <StoryBuilder />
    </RequireAuth>
  );
}
