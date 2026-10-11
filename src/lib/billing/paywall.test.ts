import assert from "node:assert/strict";
import test from "node:test";

import { paywallReason } from "./paywall";

test("payment and practice limits open checkout", () => {
  assert.equal(paywallReason("PAYMENT_REQUIRED"), "full_mock");
  assert.equal(paywallReason("SESSION_LIMIT"), "voice_practice");
  assert.equal(paywallReason("DURATION_NOT_INCLUDED"), null);
  assert.equal(paywallReason("AUTH_REQUIRED"), null);
});
