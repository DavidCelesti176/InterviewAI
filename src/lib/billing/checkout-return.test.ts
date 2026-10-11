import assert from "node:assert/strict";
import test from "node:test";

import { checkoutReturnPath, paymentIsReady } from "./checkout-return";

test("checkout returns to the interview the person was building", () => {
  assert.equal(checkoutReturnPath("/interview/new"), "/interview/new");
  assert.equal(checkoutReturnPath("/interview/live"), "/interview/live");
  assert.equal(checkoutReturnPath("/story-builder/practice"), "/story-builder/practice");
  assert.equal(checkoutReturnPath("/interview/new?checkout=success"), "/interview/new");
  assert.equal(checkoutReturnPath("https://evil.example/interview/new"), "/dashboard");
  assert.equal(checkoutReturnPath("//evil.example"), "/dashboard");
  assert.equal(checkoutReturnPath("/interview/new/../admin"), "/dashboard");
  assert.equal(checkoutReturnPath(null), "/dashboard");
});

test("a purchase is ready when a full interview credit exists", () => {
  assert.equal(paymentIsReady({ purchasedCreditsAvailable: 1, mockCreditsAvailable: 0 }), true);
  assert.equal(paymentIsReady({ purchasedCreditsAvailable: 0, mockCreditsAvailable: 3 }), true);
  assert.equal(paymentIsReady({ purchasedCreditsAvailable: 0, mockCreditsAvailable: 0 }), false);
});
