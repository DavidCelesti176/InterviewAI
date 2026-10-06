import { RequireAuth } from "@/components/auth/require-auth";
import { InterviewResults } from "@/components/interview/interview-results";

export default function ResultsPage() {
  return (
    <RequireAuth>
      <InterviewResults />
    </RequireAuth>
  );
}