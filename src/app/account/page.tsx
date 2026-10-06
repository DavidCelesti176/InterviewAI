import { AccountPage } from "@/components/account/account-page";
import { RequireAuth } from "@/components/auth/require-auth";

export default function AccountRoute() {
  return (
    <RequireAuth>
      <AccountPage />
    </RequireAuth>
  );
}
