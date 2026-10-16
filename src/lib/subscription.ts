const DAY_MS = 24 * 60 * 60 * 1000;

export const FREE_TRIAL_DAYS = 7;

export function getFreeTrialExpiry(startedAt = Date.now()): string {
  return new Date(startedAt + FREE_TRIAL_DAYS * DAY_MS).toISOString();
}

export type SubscriptionExpiry = {
  expired: boolean;
  expiringSoon: boolean;
  daysRemaining: number;
};

export function getSubscriptionExpiry(expiresAt: string, now = Date.now()): SubscriptionExpiry {
  const expiry = new Date(expiresAt).getTime();
  const remaining = expiry - now;
  if (!Number.isFinite(expiry) || remaining <= 0) {
    return { expired: true, expiringSoon: false, daysRemaining: 0 };
  }

  return {
    expired: false,
    expiringSoon: remaining < 3 * DAY_MS,
    daysRemaining: Math.max(1, Math.ceil(remaining / DAY_MS)),
  };
}
