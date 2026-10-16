import { migrateAccount } from "../src/lib/billing/minutes";
import type { BillingAccount } from "../src/lib/billing/types";

const apply = process.argv.includes("--apply");

if (!apply) {
  console.log("Dry run only. This script does not write billing records unless you pass --apply.");
  console.log("Conversion: 1 unused full-mock credit = 1800 purchased or monthly seconds. 1 unused voice-practice credit = 600 monthly seconds while Plus is active. The free Quick Practice stays 600 seconds.");
  process.exit(0);
}

export async function migrateStoredAccount(account: BillingAccount, now = Date.now()): Promise<BillingAccount> {
  return migrateAccount(account, now);
}

console.log("Refusing to scan production from this process. Call migrateStoredAccount from a reviewed admin job.");
process.exit(0);
