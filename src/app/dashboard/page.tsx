import { RequireAuth } from "@/components/auth/require-auth";
import { Dashboard } from "@/components/account/dashboard";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
