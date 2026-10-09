import { persistStripeCustomer, readBillingAccount } from "@/lib/billing/store";
import { getStripe } from "@/lib/stripe/server";

export async function stripeCustomerForUser(uid: string, email: string): Promise<string> {
  const account = await readBillingAccount(uid);
  if (account.stripeCustomerId) return account.stripeCustomerId;
  const customer = await getStripe().customers.create(
    {
      email: email || undefined,
      metadata: { firebaseUid: uid },
    },
    { idempotencyKey: `interviewai-customer-${uid}` },
  );
  return persistStripeCustomer(uid, customer.id);
}
