import assert from "node:assert/strict";
import test from "node:test";

import { checkoutMode, parseCheckoutProduct, stripePriceId } from "./catalog";
import { assertStripeTestMode } from "./server";

test("checkout accepts only internal product ids", () => {
  assert.equal(parseCheckoutProduct("full_mock"), "full_mock");
  assert.equal(parseCheckoutProduct("plus"), "plus");
  assert.equal(parseCheckoutProduct("price_123"), null);
  assert.equal(parseCheckoutProduct("pro_yearly"), null);
  assert.equal(parseCheckoutProduct({ priceId: "price_123" }), null);
  assert.equal(checkoutMode("full_mock"), "payment");
  assert.equal(checkoutMode("plus"), "subscription");
});

test("price ids come from environment variables", () => {
  const env = { STRIPE_PRICE_FULL_MOCK: "price_full", STRIPE_PRICE_PLUS: "price_plus" };
  assert.equal(stripePriceId("full_mock", env), "price_full");
  assert.equal(stripePriceId("plus", env), "price_plus");
  assert.throws(() => stripePriceId("plus", {}), /STRIPE_PRICE_PLUS/);
  assert.throws(() => stripePriceId("full_mock", { STRIPE_PRICE_FULL_MOCK: "prod_x" }), /Price id/);
});

test("live Stripe secret keys are rejected", () => {
  assert.throws(() => assertStripeTestMode({ STRIPE_SECRET_KEY: "sk_live_123" }), /Live Stripe keys/);
  assert.doesNotThrow(() => assertStripeTestMode({ STRIPE_SECRET_KEY: "sk_test_123" }));
});
