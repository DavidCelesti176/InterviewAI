import { RequireAuth } from "@/components/auth/require-auth";
import { PracticeRoom } from "@/components/interview/practice-room";

export default function PracticePage() {
  return (
    <RequireAuth>
      <PracticeRoom />
    </RequireAuth>
  );
}
