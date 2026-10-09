import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";

import { stripeEventIntent } from "./intents";

const env = {
  STRIPE_PRICE_FULL_MOCK: "price_full",
  STRIPE_PRICE_PLUS: "price_plus",
};

function event(type: Stripe.Event.Type, object: object, id = "evt_1"): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2026-09-30.endive",
    created: 1,
    data: { object: object as Stripe.Event.Data.Object },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
  } as Stripe.Event;
}

test("a paid full mock checkout grants one purchased credit", () => {
  const intent = stripeEventIntent(
    event("checkout.session.completed", {
      id: "cs_1",
      mode: "payment",
      payment_status: "paid",
      customer: "cus_1",
      client_reference_id: "user_1",
      metadata: { firebaseUid: "user_1", purchaseType: "full_mock" },
      line_items: { data: [{ price: { id: "price_full" } }] },
    }),
    env,
  );
  assert.deepEqual(intent, {
    kind: "grant_full_mock",
    uid: "user_1",
    customerId: "cus_1",
    checkoutSessionId: "cs_1",
    eventId: "evt_1",
  });
});

test("plus checkout only syncs ids and does not grant a period", () => {
  const intent = stripeEventIntent(
    event("checkout.session.completed", {
      id: "cs_plus",
      mode: "subscription",
      customer: "cus_1",
      subscription: "sub_1",
      metadata: { firebaseUid: "user_1", purchaseType: "plus" },
    }),
    env,
  );
  assert.equal(intent.kind, "sync_plus_ids");
});

test("invoice.paid starts a plus period and retries use the same event id", () => {
  const payload = {
    id: "in_1",
    status: "paid",
    billing_reason: "subscription_cycle",
    customer: "cus_1",
    parent: { subscription_details: { subscription: "sub_1" } },
    lines: { data: [{ period: { start: 1_000, end: 2_000 } }] },
    metadata: { firebaseUid: "user_1" },
  };
  const first = stripeEventIntent(event("invoice.paid", payload, "evt_paid"), env);
  const retry = stripeEventIntent(event("invoice.paid", payload, "evt_paid"), env);
  assert.equal(first.kind, "grant_plus_period");
  if (first.kind !== "grant_plus_period") return;
  assert.equal(first.periodStart, 1_000_000);
  assert.equal(first.periodEnd, 2_000_000);
  assert.equal(first.eventId, retry.eventId);
});

test("invoice.payment_failed does not grant a period", () => {
  const intent = stripeEventIntent(
    event("invoice.payment_failed", {
      id: "in_fail",
      customer: "cus_1",
      parent: { subscription_details: { subscription: "sub_1" } },
      metadata: { firebaseUid: "user_1" },
    }),
    env,
  );
  assert.equal(intent.kind, "plus_payment_failed");
});

test("cancel at period end stays a sync and deletion ends plus", () => {
  const updated = stripeEventIntent(
    event("customer.subscription.updated", {
      id: "sub_1",
      status: "active",
      cancel_at_period_end: true,
      customer: "cus_1",
      metadata: { firebaseUid: "user_1" },
      items: { data: [{ current_period_start: 10, current_period_end: 20 }] },
    }),
    env,
  );
  assert.equal(updated.kind, "sync_plus_subscription");
  if (updated.kind !== "sync_plus_subscription") return;
  assert.equal(updated.cancelAtPeriodEnd, true);
  const deleted = stripeEventIntent(
    event("customer.subscription.deleted", {
      id: "sub_1",
      status: "canceled",
      customer: "cus_1",
      metadata: { firebaseUid: "user_1" },
    }),
    env,
  );
  assert.equal(deleted.kind, "end_plus_subscription");
});

test("live events and unexpected prices are ignored", () => {
  const live = event("checkout.session.completed", {
    id: "cs_live",
    mode: "payment",
    metadata: { firebaseUid: "user_1", purchaseType: "full_mock" },
  });
  live.livemode = true;
  assert.equal(stripeEventIntent(live, env).kind, "ignore");
  const wrongPrice = stripeEventIntent(
    event("checkout.session.completed", {
      id: "cs_2",
      mode: "payment",
      payment_status: "paid",
      customer: "cus_1",
      metadata: { firebaseUid: "user_1", purchaseType: "full_mock" },
      line_items: { data: [{ price: { id: "price_other" } }] },
    }),
    env,
  );
  assert.equal(wrongPrice.kind, "ignore");
});

test("a full mock refund is reversible and other refunds need review", () => {
  const refund = stripeEventIntent(
    event("charge.refunded", { id: "ch_1", metadata: { firebaseUid: "user_1", purchaseType: "full_mock" } }),
    env,
  );
  assert.equal(refund.kind, "refund_full_mock");
  const review = stripeEventIntent(event("charge.refunded", { id: "ch_2", metadata: { firebaseUid: "user_1" } }), env);
  assert.equal(review.kind, "refund_review");
});
