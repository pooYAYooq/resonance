---
name: convex-env
description: "Set and wire Convex deployment env vars / secrets for the app."
---

<!-- GENERATED from convex-agents content/capabilities/env.json — do not edit by hand. -->

# Manage env vars + secrets

Store secrets as Convex deployment env vars (npx convex env set), read them with process.env in actions, never commit them.

## Workflow

1. `npx convex env set KEY value` (per deployment).
2. Read via process.env.KEY inside actions (not queries/mutations).
3. Never hardcode or commit secrets; add to .env.local only for local.
4. Confirm it's set in the Convex dashboard. On the pinned CLI 1.34.0, `npx convex env list` prints current values and has no names-only flag, so run it only when that is acceptable.

## Rules

- Secrets live in Convex env vars, never in code or git.
- process.env only in actions ('use node' if needed), not queries/mutations.
- Different deployments need their own values.
- Check what is set in the Convex dashboard; on the pinned CLI 1.34.0 `npx convex env list` prints values. Never print secret values into the conversation.
