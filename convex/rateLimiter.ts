/**
 * Transactional allowances for username claims and follow notifications.
 * Notification limits apply per actor/recipient pair, independently of follows.
 */
import { DAY, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const FOLLOW_NOTIFICATION_LIMIT = "followNotification";
export const FOLLOW_NOTIFICATION_PERIOD_MS = 7 * DAY;

export const USERNAME_CLAIM_LIMIT = "newUsernameClaim";
export const USERNAME_CLAIM_PERIOD_MS = 90 * DAY;

/**
 * One token per 90 elapsed days with a capacity of one, so idle time cannot
 * accumulate extra claims. Transactional updates keep the token in the same
 * transaction as the ownership write.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  followNotification: {
    kind: "token bucket",
    rate: 1,
    period: FOLLOW_NOTIFICATION_PERIOD_MS,
    capacity: 1,
    applyUpdates: "transactionally",
  },
  newUsernameClaim: {
    kind: "token bucket",
    rate: 1,
    period: USERNAME_CLAIM_PERIOD_MS,
    capacity: 1,
    applyUpdates: "transactionally",
  },
});
