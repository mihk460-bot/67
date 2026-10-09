import { describe, expect, it } from "vitest";
import { getSubscriptionExpiry } from "@/lib/subscription";

describe("getSubscriptionExpiry", () => {
  const now = new Date("2026-10-09T12:00:00.000Z").getTime();

  it("shows an alert inside the final three days and rounds up remaining days", () => {
    expect(getSubscriptionExpiry(new Date(now + 2.5 * 24 * 60 * 60 * 1000).toISOString(), now)).toEqual({
      expired: false,
      expiringSoon: true,
      daysRemaining: 3,
    });
  });

  it("does not show the alert at three days and marks passed subscriptions expired", () => {
    expect(getSubscriptionExpiry(new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(), now).expiringSoon).toBe(false);
    expect(getSubscriptionExpiry(new Date(now - 1).toISOString(), now)).toEqual({
      expired: true,
      expiringSoon: false,
      daysRemaining: 0,
    });
  });
});
