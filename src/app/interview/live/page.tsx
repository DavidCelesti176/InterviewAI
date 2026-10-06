import { RequireAuth } from "@/components/auth/require-auth";
import { LiveInterview } from "@/components/interview/live-interview";

export default function LiveInterviewPage() {
  return (
    <RequireAuth>
      <LiveInterview />
    </RequireAuth>
  );
}
