import { RequireAuth } from "@/components/auth/require-auth";
import { InterviewForm } from "@/components/interview/interview-form";

export default function NewInterviewPage() {
  return (
    <RequireAuth>
      <InterviewForm />
    </RequireAuth>
  );
}
