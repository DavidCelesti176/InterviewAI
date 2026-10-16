export type PlanId = "free" | "plus";
export type SubscriptionStatus = null | "active" | "past_due" | "canceled";
export type SessionClass = "quick_practice" | "full_mock" | "voice_practice";
export type PracticeKind = null | "story" | "weak_answer";
export type AnalysisTier = "basic" | "full";
export type EntitlementSource = "free_quick" | "plus_mock" | "purchased_mock" | "plus_practice";
export type ReservationStatus = "reserved" | "consumed" | "released";
export type EntitlementCode =
  | "AUTH_REQUIRED"
  | "PAYMENT_REQUIRED"
  | "CREDIT_RESERVED"
  | "SESSION_LIMIT"
  | "ENTITLEMENT_CHECK_FAILED"
  | "DURATION_NOT_INCLUDED";

export type BillingAccount = {
  plan: PlanId;
  subscriptionStatus: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  periodStart: number | null;
  periodEnd: number | null;
  mockGrant: number;
  mockConsumed: number;
  mockReserved: number;
  practiceGrant: number;
  practiceConsumed: number;
  practiceReserved: number;
  purchasedRemaining: number;
  purchasedReserved: number;
  freeQuickUsedAt: number | null;
  freeQuickReserved: number;
  freeQuickSecondsGrant: number;
  freeQuickSecondsConsumed: number;
  freeQuickSecondsReserved: number;
  monthlySecondsGrant: number;
  monthlySecondsConsumed: number;
  monthlySecondsReserved: number;
  purchasedSecondsGrant: number;
  purchasedSecondsConsumed: number;
  purchasedSecondsReserved: number;
  minutesMigratedAt: number | null;
  lifetimeFullInterviews: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  openReservationIds: string[];
  updatedAt: number;
};

export type LiveSegment = {
  liveStartedAt: number;
  liveEndedAt: number | null;
  wallClockSeconds: number;
  reportedUsageSeconds: number | null;
};

export type SessionGrant = {
  sessionId: string;
  interviewId: string | null;
  sessionClass: SessionClass;
  practiceKind: PracticeKind;
  targetMinutes: number;
  maxMinutes: number;
  analysisTier: AnalysisTier;
  entitlementSource: EntitlementSource | null;
  reconnectCount: number;
  reconnectClaimExpiresAt: number | null;
  candidateSpoke: boolean;
  firstLiveStartedAt: number | null;
  liveSegments: LiveSegment[];
  liveWallClockSeconds: number;
  reportedUsageSeconds: number | null;
  createdAt: number;
  authorizedSeconds?: number;
  consumedSeconds?: number | null;
  billingStartedAt?: number | null;
  billingEndedAt?: number | null;
};

export type Reservation = {
  reservationId: string;
  sessionId: string;
  status: ReservationStatus;
  source: EntitlementSource | "reconnect";
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
  liveSessionId: string | null;
  authorizedSeconds: number;
  freeSeconds: number;
  monthlySeconds: number;
  purchasedSeconds: number;
  monthlyPeriodStart: number | null;
  liveCreatedAt: number | null;
  startedAt: number | null;
  lastHeartbeatAt: number | null;
  consumedSeconds: number | null;
};

export type BillingProjection = {
  plan: PlanId;
  mockCreditsAvailable: number;
  practiceSessionsAvailable: number;
  purchasedCreditsAvailable: number;
  monthlySecondsAvailable: number;
  purchasedSecondsAvailable: number;
  paidSecondsAvailable: number;
  freeQuickSecondsAvailable: number;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  freeQuickAvailable: boolean;
};

export type BillingEventName =
  | "credit_granted"
  | "credit_reserved"
  | "credit_consumed"
  | "credit_released"
  | "subscription_period_started"
  | "subscription_synced"
  | "subscription_past_due"
  | "subscription_canceled"
  | "manual_test_grant"
  | "refund"
  | "refund_review";

export type BillingAuditEvent = {
  name: BillingEventName;
  at: number;
  stripeEventId: string;
  source: string;
  invoiceId?: string | null;
  checkoutSessionId?: string | null;
  subscriptionId?: string | null;
  needsReview?: boolean;
};
