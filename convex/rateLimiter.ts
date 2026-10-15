/**
 * The one authority for how often an account may claim a previously unowned
 * username. Ownership lives in `usernameClaims`; this component supplies the
 * per-account allowance and its transaction-scoped enforcement.
 */
import { DAY, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const USERNAME_CLAIM_LIMIT = "newUsernameClaim";
export const USERNAME_CLAIM_PERIOD_MS = 90 * DAY;

/**
 * One token per 90 elapsed days with a capacity of one, so idle time cannot
 * accumulate extra claims. Transactional updates keep the token in the same
 * transaction as the ownership write.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  newUsernameClaim: {
    kind: "token bucket",
    rate: 1,
    period: USERNAME_CLAIM_PERIOD_MS,
    capacity: 1,
    applyUpdates: "transactionally",
  },
});
