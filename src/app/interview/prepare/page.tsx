import { RequireAuth } from "@/components/auth/require-auth";
import { PrepareInterview } from "@/components/interview/prepare-interview";

export default function PreparePage() {
  return (
    <RequireAuth>
      <PrepareInterview />
    </RequireAuth>
  );
}
