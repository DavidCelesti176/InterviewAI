import { RequireAuth } from "@/components/auth/require-auth";
import { InterviewResults } from "@/components/interview/interview-results";

export default async function InterviewResultsPage({ params }: { params: Promise<{ interviewId: string }> }) {
  const { interviewId } = await params;
  return (
    <RequireAuth>
      <InterviewResults interviewId={interviewId} />
    </RequireAuth>
  );
}
