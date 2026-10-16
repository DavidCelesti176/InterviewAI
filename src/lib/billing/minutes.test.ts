import assert from "node:assert/strict";
import test from "node:test";

import { emptyBilling, endPlusSubscription, grantPurchasedCredit, releaseReservation, renewalEventDecision, renewPlusPeriod, startPlusPeriod } from "./decide";
import {
  clientUsageRejected,
  CONNECT_GRACE_MS,
  FREE_QUICK_SECONDS,
  heartbeatAccess,
  heartbeatDueDelay,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS,
  markConnected,
  markHeartbeat,
  migrateAccount,
  minutePools,
  PACK_SECONDS,
  PLUS_PERIOD_SECONDS,
  PRACTICE_CREDIT_SECONDS,
  reserveMinutes,
  settleReservation,
  staleUsage,
  usageSeconds,
} from "./minutes";
import type { Reservation } from "./types";

const now = Date.parse("2026-10-16T15:00:00.000Z");

function reservation(partial: Partial<Reservation> = {}): Reservation {
  return {
    reservationId: "hold",
    sessionId: "session",
    status: "reserved",
    source: "plus_mock",
    createdAt: now,
    expiresAt: now + 60_000,
    consumedAt: null,
    liveSessionId: "live",
    authorizedSeconds: 1800,
    freeSeconds: 0,
    monthlySeconds: 1800,
    purchasedSeconds: 0,
    liveCreatedAt: now,
    startedAt: now,
    lastHeartbeatAt: now,
    consumedSeconds: null,
    monthlyPeriodStart: now,
    ...partial,
  };
}

test("a 30-minute reservation that ends after 12 minutes releases 18 minutes", () => {
  const plus = startPlusPeriod(emptyBilling(now), now, now + 86_400_000, now);
  const reserved = reserveMinutes(plus, 1800, "paid", now);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  assert.equal(reserved.reserved.monthlySeconds, 1800);
  assert.equal(reserved.reserved.purchasedSeconds, 0);
  const hold = reservation({
    monthlySeconds: 1800,
    purchasedSeconds: 0,
    authorizedSeconds: 1800,
    startedAt: now,
  });
  const settled = settleReservation(reserved.reserved.account, hold, usageSeconds(now, now + 12 * 60 * 1000, 1800), now + 12 * 60 * 1000);
  assert.ok(settled);
  assert.equal(settled?.reservation.consumedSeconds, 720);
  assert.equal(settled?.account.monthlySecondsConsumed, 720);
  assert.equal(settled?.account.monthlySecondsReserved, 0);
  assert.equal(minutePools(settled!.account, now).monthly, PLUS_PERIOD_SECONDS - 720);
});

test("monthly minutes are consumed before purchased minutes", () => {
  const plus = {
    ...startPlusPeriod(emptyBilling(now), now, now + 86_400_000, now),
    monthlySecondsGrant: 20 * 60,
    purchasedSecondsGrant: 30 * 60,
  };
  const reserved = reserveMinutes(plus, 30 * 60, "paid", now);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  assert.equal(reserved.reserved.monthlySeconds, 20 * 60);
  assert.equal(reserved.reserved.purchasedSeconds, 10 * 60);
  const hold = reservation({
    monthlySeconds: 20 * 60,
    purchasedSeconds: 10 * 60,
    authorizedSeconds: 30 * 60,
    source: "plus_mock",
  });
  const settled = settleReservation(reserved.reserved.account, hold, 12 * 60, now + 12 * 60 * 1000);
  assert.equal(settled?.account.monthlySecondsConsumed, 12 * 60);
  assert.equal(settled?.account.purchasedSecondsConsumed, 0);
  assert.equal(settled?.account.purchasedSecondsReserved, 0);
  assert.equal(minutePools(settled!.account, now).monthly, 8 * 60);
  assert.equal(minutePools(settled!.account, now).purchased, 30 * 60);
});

test("a session can span monthly and purchased balances", () => {
  const plus = {
    ...startPlusPeriod(emptyBilling(now), now, now + 86_400_000, now),
    monthlySecondsGrant: 20 * 60,
    purchasedSecondsGrant: 30 * 60,
  };
  const reserved = reserveMinutes(plus, 25 * 60, "paid", now);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const hold = reservation({ monthlySeconds: 20 * 60, purchasedSeconds: 5 * 60, authorizedSeconds: 25 * 60 });
  const settled = settleReservation(reserved.reserved.account, hold, 25 * 60, now);
  assert.equal(settled?.account.monthlySecondsConsumed, 20 * 60);
  assert.equal(settled?.account.purchasedSecondsConsumed, 5 * 60);
  assert.equal(minutePools(settled!.account, now).purchased, 25 * 60);
});

test("two reservations cannot spend the same seconds", () => {
  const plus = startPlusPeriod(emptyBilling(now), now, now + 86_400_000, now);
  const first = reserveMinutes(plus, 5400, "paid", now);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = reserveMinutes(first.reserved.account, 60, "paid", now);
  assert.equal(second.ok, false);
});

test("a failed live create releases the full reservation", () => {
  const plus = startPlusPeriod(emptyBilling(now), now, now + 86_400_000, now);
  const reserved = reserveMinutes(plus, 1800, "paid", now);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const hold = reservation({ liveCreatedAt: null, startedAt: null, monthlySeconds: 1800, authorizedSeconds: 1800 });
  const released = releaseReservation(reserved.reserved.account, hold, now);
  assert.equal(released?.reservation.status, "released");
  assert.equal(released?.reservation.consumedSeconds, 0);
  assert.equal(minutePools(released!.account, now).monthly, PLUS_PERIOD_SECONDS);
});

test("11:37 consumes 697 seconds and does not round up", () => {
  assert.equal(usageSeconds(now, now + (11 * 60 + 37) * 1000, 1800), 697);
  const plus = startPlusPeriod(emptyBilling(now), now, now + 86_400_000, now);
  const reserved = reserveMinutes(plus, 1800, "paid", now);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const settled = settleReservation(reserved.reserved.account, reservation(), 697, now);
  assert.equal(settled?.account.monthlySecondsConsumed, 697);
});

test("pause time stays inside connected usage", () => {
  const started = now;
  const ended = started + 12 * 60 * 1000;
  assert.equal(usageSeconds(started, ended, 1800), 720);
});

test("a normal end settles from server timestamps and a second end does not charge again", () => {
  const plus = startPlusPeriod(emptyBilling(now), now, now + 86_400_000, now);
  const reserved = reserveMinutes(plus, 1800, "paid", now);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const hold = reservation({ startedAt: now });
  const ended = now + 8 * 60 * 1000;
  const first = settleReservation(reserved.reserved.account, hold, usageSeconds(hold.startedAt, ended, hold.authorizedSeconds), ended);
  assert.equal(first?.reservation.consumedSeconds, 480);
  const second = settleReservation(first!.account, first!.reservation, 1800, ended + 1000);
  assert.equal(second, null);
  assert.equal(first?.account.monthlySecondsConsumed, 480);
});

test("a missed end settles through the last heartbeat instead of the whole reservation", () => {
  const plus = startPlusPeriod(emptyBilling(now), now, now + 86_400_000, now);
  const reserved = reserveMinutes(plus, 1800, "paid", now);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const started = now;
  const last = started + 5 * 60 * 1000;
  const hold = reservation({ startedAt: started, lastHeartbeatAt: last, liveCreatedAt: started });
  const later = last + HEARTBEAT_STALE_MS + 1;
  const stale = staleUsage(hold, later);
  assert.equal(stale.settle, true);
  if (!stale.settle) return;
  assert.equal(stale.consumedSeconds, 300);
  const settled = settleReservation(reserved.reserved.account, hold, stale.consumedSeconds, later);
  assert.equal(settled?.account.monthlySecondsConsumed, 300);
  assert.equal(minutePools(settled!.account, now).monthly, PLUS_PERIOD_SECONDS - 300);
});

test("no heartbeat after live.create releases the reservation", () => {
  const hold = reservation({ startedAt: null, lastHeartbeatAt: null, liveCreatedAt: now });
  assert.equal(staleUsage(hold, now + CONNECT_GRACE_MS - 1).settle, false);
  const stale = staleUsage(hold, now + CONNECT_GRACE_MS + 1);
  assert.deepEqual(stale, { settle: true, consumedSeconds: 0 });
});

test("duplicate grants are a caller concern and one grant is 1800 purchased seconds", () => {
  const once = grantPurchasedCredit(emptyBilling(now), now);
  const twice = grantPurchasedCredit(once, now);
  assert.equal(once.purchasedSecondsGrant, PACK_SECONDS);
  assert.equal(twice.purchasedSecondsGrant, PACK_SECONDS * 2);
});

test("Plus renewal resets monthly seconds and keeps purchased seconds", () => {
  const first = {
    ...startPlusPeriod(emptyBilling(now), now - 1000, now + 1000, now),
    purchasedSecondsGrant: PACK_SECONDS,
    monthlySecondsConsumed: 400,
  };
  const renewed = startPlusPeriod(first, now, now + 86_400_000, now);
  assert.equal(renewed.monthlySecondsGrant, PLUS_PERIOD_SECONDS);
  assert.equal(renewed.monthlySecondsConsumed, 0);
  assert.equal(renewed.monthlySecondsReserved, 0);
  assert.equal(renewed.purchasedSecondsGrant, PACK_SECONDS);
});

test("purchased minutes survive cancellation", () => {
  const plus = { ...startPlusPeriod(emptyBilling(now), now, now + 86_400_000, now), purchasedSecondsGrant: PACK_SECONDS };
  const ended = endPlusSubscription(plus, now);
  assert.equal(ended.purchasedSecondsGrant, PACK_SECONDS);
  assert.equal(minutePools(ended, now).monthly, 0);
  assert.equal(minutePools(ended, now).purchased, PACK_SECONDS);
});

test("a low balance shortens the authorization", () => {
  const account = { ...emptyBilling(now), purchasedSecondsGrant: 742, minutesMigratedAt: now };
  const reserved = reserveMinutes(account, 1800, "paid", now);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  assert.equal(reserved.reserved.authorizedSeconds, 742);
  assert.equal(reserved.reserved.purchasedSeconds, 742);
  assert.equal(reserved.reserved.monthlySeconds, 0);
});

test("the free Quick Practice stays out of the paid wallet", () => {
  const free = emptyBilling(now);
  const paid = reserveMinutes(free, 600, "paid", now);
  assert.equal(paid.ok, false);
  const quick = reserveMinutes(free, 600, "free", now);
  assert.equal(quick.ok, true);
  if (!quick.ok) return;
  assert.equal(quick.reserved.freeSeconds, FREE_QUICK_SECONDS);
  assert.equal(quick.reserved.account.purchasedSecondsReserved, 0);
  assert.equal(quick.reserved.account.monthlySecondsReserved, 0);
});

test("heartbeat identity and client duration are rejected", () => {
  assert.equal(heartbeatAccess(null, "user-a"), "unsigned");
  assert.equal(heartbeatAccess("user-b", "user-a"), "forbidden");
  assert.equal(heartbeatAccess("user-a", "user-a"), "ok");
  assert.equal(clientUsageRejected({ sessionId: "s", consumedSeconds: 10 }), true);
  assert.equal(clientUsageRejected({ sessionId: "s", elapsedSeconds: 10 }), true);
  assert.equal(clientUsageRejected({ sessionId: "s", balance: 1 }), true);
  assert.equal(clientUsageRejected({ sessionId: "s" }), false);
});

test("old credits migrate without losing value", () => {
  const legacy = {
    ...emptyBilling(now),
    minutesMigratedAt: null,
    freeQuickSecondsGrant: 0,
    purchasedRemaining: 1,
    purchasedReserved: 0,
    plan: "plus" as const,
    subscriptionStatus: "active" as const,
    periodStart: now - 1000,
    periodEnd: now + 86_400_000,
    mockGrant: 2,
    mockConsumed: 0,
    mockReserved: 1,
    practiceGrant: 3,
    practiceConsumed: 1,
    practiceReserved: 0,
    freeQuickUsedAt: null,
  };
  const migrated = migrateAccount(legacy, now);
  assert.equal(migrated.purchasedSecondsGrant, PACK_SECONDS);
  assert.equal(migrated.monthlySecondsGrant, 2 * PACK_SECONDS + 2 * PRACTICE_CREDIT_SECONDS);
  assert.equal(migrated.monthlySecondsReserved, PACK_SECONDS);
  assert.equal(minutePools(migrated, now).monthly, PACK_SECONDS + 2 * PRACTICE_CREDIT_SECONDS);
  assert.equal(minutePools(migrated, now).free, FREE_QUICK_SECONDS);
  const again = migrateAccount(migrated, now + 1);
  assert.equal(again.purchasedSecondsGrant, migrated.purchasedSecondsGrant);
  assert.equal(again.monthlySecondsGrant, migrated.monthlySecondsGrant);
});

test("the first heartbeat starts usage immediately and live.create does not", () => {
  assert.equal(heartbeatDueDelay(0), 0);
  assert.equal(heartbeatDueDelay(1), HEARTBEAT_INTERVAL_MS);
  const created = markConnected(reservation({ liveCreatedAt: null, startedAt: null, lastHeartbeatAt: null }), now);
  assert.equal(created.startedAt, null);
  assert.equal(usageSeconds(created.startedAt, now + 12_000, 1800), 0);
  const immediate = markHeartbeat(created, now);
  assert.equal(immediate?.startedAt, now);
  assert.equal(usageSeconds(immediate!.startedAt, now + 12_000, 1800), 12);
  const second = markHeartbeat(immediate!, now + HEARTBEAT_INTERVAL_MS);
  assert.equal(second?.startedAt, now);
  assert.equal(second?.lastHeartbeatAt, now + HEARTBEAT_INTERVAL_MS);
  const late = markHeartbeat(markConnected(reservation({ liveCreatedAt: null, startedAt: null, lastHeartbeatAt: null }), now), now + HEARTBEAT_INTERVAL_MS);
  assert.equal(usageSeconds(late!.startedAt, now + 12_000, 1800), 0);
});

function openAcrossRenewal() {
  const oldStart = now;
  const oldEnd = now + 86_400_000;
  const nextStart = oldEnd;
  const nextEnd = oldEnd + 86_400_000;
  const plus = {
    ...startPlusPeriod(emptyBilling(oldStart), oldStart, oldEnd, oldStart),
    monthlySecondsGrant: 20 * 60,
    purchasedSecondsGrant: 30 * 60,
  };
  const reserved = reserveMinutes(plus, 30 * 60, "paid", oldStart);
  if (!reserved.ok) throw new Error("reservation failed");
  const hold = reservation({
    monthlySeconds: reserved.reserved.monthlySeconds,
    purchasedSeconds: reserved.reserved.purchasedSeconds,
    authorizedSeconds: reserved.reserved.authorizedSeconds,
    monthlyPeriodStart: oldStart,
    startedAt: oldStart,
    liveCreatedAt: oldStart,
    lastHeartbeatAt: oldStart,
  });
  return { account: reserved.reserved.account, hold, oldStart, nextStart, nextEnd };
}

test("a session that starts and ends before renewal spends that period only", () => {
  const { account, hold, oldStart } = openAcrossRenewal();
  const settled = settleReservation(account, hold, 12 * 60, oldStart + 12 * 60 * 1000);
  assert.equal(settled?.account.monthlySecondsConsumed, 12 * 60);
  assert.equal(settled?.account.purchasedSecondsConsumed, 0);
  assert.equal(settled?.account.purchasedSecondsReserved, 0);
  assert.equal(settled?.account.periodStart, oldStart);
  assert.equal(minutePools(settled!.account, oldStart).monthly, 8 * 60);
  assert.equal(minutePools(settled!.account, oldStart).purchased, 30 * 60);
});

test("a session that starts before renewal and ends after it does not spend the new grant", () => {
  const { account, hold, nextStart, nextEnd } = openAcrossRenewal();
  const renewed = renewPlusPeriod(account, [hold], nextStart, nextEnd, nextStart);
  assert.equal(renewed.reservations[0]?.status, "reserved");
  assert.equal(renewed.reservations[0]?.authorizedSeconds, 30 * 60);
  const settled = settleReservation(renewed.account, renewed.reservations[0]!, 12 * 60, nextStart + 12 * 60 * 1000);
  assert.equal(settled?.reservation.consumedSeconds, 12 * 60);
  assert.equal(settled?.account.monthlySecondsGrant, PLUS_PERIOD_SECONDS);
  assert.equal(settled?.account.monthlySecondsConsumed, 0);
  assert.equal(settled?.account.monthlySecondsReserved, 0);
  assert.equal(settled?.account.purchasedSecondsConsumed, 0);
  assert.equal(minutePools(settled!.account, nextStart).monthly, PLUS_PERIOD_SECONDS);
  assert.equal(minutePools(settled!.account, nextStart).purchased, 30 * 60);
});

test("renewal keeps an active monthly reservation and expires unused old monthly seconds", () => {
  const { account, hold, nextStart, nextEnd } = openAcrossRenewal();
  const renewed = renewPlusPeriod(account, [hold], nextStart, nextEnd, nextStart);
  assert.equal(renewed.reservations[0]?.monthlySeconds, 20 * 60);
  assert.equal(renewed.reservations[0]?.monthlyPeriodStart, account.periodStart);
  assert.equal(renewed.account.monthlySecondsReserved, 0);
  assert.equal(renewed.account.purchasedSecondsReserved, 10 * 60);
  assert.equal(minutePools(renewed.account, nextStart).monthly, PLUS_PERIOD_SECONDS);
  assert.equal(minutePools(renewed.account, nextStart).purchased, 20 * 60);
});

test("a reservation that spans monthly and purchased seconds keeps the purchased hold across renewal", () => {
  const { account, hold, nextStart, nextEnd } = openAcrossRenewal();
  const renewed = renewPlusPeriod(account, [hold], nextStart, nextEnd, nextStart);
  const settled = settleReservation(renewed.account, renewed.reservations[0]!, 25 * 60, nextStart + 1000);
  assert.equal(settled?.account.monthlySecondsConsumed, 0);
  assert.equal(settled?.account.purchasedSecondsConsumed, 5 * 60);
  assert.equal(settled?.account.purchasedSecondsReserved, 0);
  assert.equal(minutePools(settled!.account, nextStart).monthly, PLUS_PERIOD_SECONDS);
  assert.equal(minutePools(settled!.account, nextStart).purchased, 25 * 60);
});

test("a duplicate renewal event does not reset the new period", () => {
  const { account, hold, nextStart, nextEnd } = openAcrossRenewal();
  const event = { eventId: "evt_renew", invoiceId: "in_renew", subscriptionId: "sub_1", periodStart: nextStart };
  const seen = { eventIds: [] as string[], keys: [] as string[] };
  assert.equal(renewalEventDecision(seen, event), "apply");
  const first = renewPlusPeriod(account, [hold], nextStart, nextEnd, nextStart);
  const during = reserveMinutes(first.account, 60, "paid", nextStart + 1);
  assert.equal(during.ok, true);
  if (!during.ok) return;
  const again = renewPlusPeriod(during.reserved.account, [hold], nextStart, nextEnd, nextStart + 5);
  assert.equal(again.account.monthlySecondsGrant, PLUS_PERIOD_SECONDS);
  assert.equal(again.account.monthlySecondsReserved, 60);
  assert.equal(again.account.purchasedSecondsGrant, 30 * 60);
  const recorded = { eventIds: [event.eventId], keys: [`invoice:${event.invoiceId}`, `period:${event.subscriptionId}:${event.periodStart}`] };
  assert.equal(renewalEventDecision(recorded, event), "duplicate_event");
  assert.equal(renewalEventDecision(recorded, { ...event, eventId: "evt_renew_2" }), "duplicate_invariant");
});

test("settlement and renewal leave the same balances in either order", () => {
  const used = 25 * 60;
  const settleFirst = openAcrossRenewal();
  const settled = settleReservation(settleFirst.account, settleFirst.hold, used, settleFirst.oldStart + used * 1000);
  const renewAfter = renewPlusPeriod(settled!.account, [settled!.reservation], settleFirst.nextStart, settleFirst.nextEnd, settleFirst.nextStart);
  const renewFirst = openAcrossRenewal();
  const renewed = renewPlusPeriod(renewFirst.account, [renewFirst.hold], renewFirst.nextStart, renewFirst.nextEnd, renewFirst.nextStart);
  const settleAfter = settleReservation(renewed.account, renewed.reservations[0]!, used, renewFirst.nextStart + 1000);
  assert.equal(minutePools(renewAfter.account, settleFirst.nextStart).monthly, PLUS_PERIOD_SECONDS);
  assert.equal(minutePools(settleAfter!.account, renewFirst.nextStart).monthly, PLUS_PERIOD_SECONDS);
  assert.equal(minutePools(renewAfter.account, settleFirst.nextStart).purchased, minutePools(settleAfter!.account, renewFirst.nextStart).purchased);
  assert.equal(renewAfter.account.purchasedSecondsConsumed, 5 * 60);
  assert.equal(settleAfter?.account.purchasedSecondsConsumed, 5 * 60);
  assert.equal(settleAfter?.account.monthlySecondsConsumed, 0);
});
