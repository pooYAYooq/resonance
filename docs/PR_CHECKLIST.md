# PR workflow

Use this procedure for a new PR, review fixes on an existing PR, and the final
merge handoff. Message and approval rules live in [AGENTS.md](../AGENTS.md).
GitHub records the PR lifecycle; repository docs describe their revision.

GitHub enforcement is a separate repository setting. For solo development,
require PRs and the CI `checks` and `ui-tests` jobs on `main` without requiring
another person's approval. Verify the actual branch protection/ruleset before
claiming this is enforced; changing those settings needs maintainer approval.

## 1. Scope and branch

- Confirm the approved outcome and read [status.md](status.md). Consult only
  the relevant [roadmap](../ROADMAP.md) items and design/evidence references.
- Inspect the worktree and preserve unrelated work. Use an outcome-named,
  non-`main` branch from the intended base.
- Check whether this branch already has an open PR before creating one.
  Reuse it throughout review. Do not recreate a closed or merged PR without
  confirming the intended new work with the maintainer.

## 2. Code and documentation together

- Update behavior docs alongside the implementation and each review fix.
- Keep scope, estimates, dependencies, and approved deferrals in `ROADMAP.md`.
  Mark Done only after the agreed implementation and verification are complete.
  Partial implementation or outstanding required acceptance stays In progress.
- Update `FEATURES.md`, architecture, README, or Unreleased changelog entries
  when their documented capability, structure, or release-facing behavior changes.
- Keep `docs/status.md` short: replace the old focus, next action, and blockers.
  PR state, approvals, pending pushes, and merge hashes belong in GitHub or
  the conversation, not in the resume note.
- Put detailed test outcomes and retest triggers in the relevant evidence
  document. Record unverified behavior honestly and obtain approval to defer
  findings. A deferral is not a pass.
- Preserve unique information before removing duplicate or historical prose.
  A PR or immutable Git reference can carry history; active requirements and
  limitations must remain easy to find in tracked docs.

## 3. Verification and artifact check

- Run lint, edge tests, component tests, and build in the order in `AGENTS.md`
  for code changes and final implementation handoff. Use the single-worker
  component command when needed for the recorded worker-contention baseline.
- For documentation-only changes, check changed-file formatting, links, factual
  claims, and instruction consistency. Exercise changed scripts/workflows if
  present. Explain which checks apply instead of claiming unrun suites pass.
- Reuse valid results for unchanged code. Rerun affected checks when code,
  dependencies, base integration, or failures invalidate those results. Verify
  the pushed head's required GitHub checks before recommending merge.
- Review the full branch diff, including new untracked source files, for
  unrelated changes, credentials, accidental artifacts, and missing docs.
- Stage only explicit approved paths. Inspect `git diff --cached --name-only`
  and the staged diff, then run `pnpm check:artifacts` before committing.
  Exclude `docs/superpowers/`, local plans, scratch output,
  logs, screenshots, and draft messages. Check the branch diff as well: a clean
  index does not prove earlier commits contain no artifacts.
- Known artifact paths are ignored and checked in CI against the checked-out
  index. The check does not inspect commit history or recognize arbitrary
  filenames, so manual branch-diff inspection remains necessary. There is no
  installed pre-commit hook. Run `pnpm test:tooling` when changing the check.
- Archive completed local artifacts only after durable docs capture the useful
  outcome. The external archive is supporting material, not required clone content.

## 4. Commit, push, and PR message

- Obtain the approvals required by `AGENTS.md`. A request to push an existing
  PR's branch authorizes that push, not metadata edits, replies, or a merge.
- Present the exact commit message and PR title/description in the conversation
  for review. Keep scratch copies outside the repository; the conversation is
  the review surface, and the durable copies are the commit and the PR.
- Use a full Conventional Commit: specific imperative subject, meaningful
  what/why body, and relevant footers. Check the subject length and prohibit
  en/em dashes in both commit and PR messages.
- Before pushing, confirm the current branch is not `main`, the destination
  is that branch, and every intended commit belongs to the approved work.
  Investigate remote divergence; never force-push as an automatic fallback.
- A PR title names the outcome, without internal planning identifiers.
  Its description explains the change and rationale, verification/results,
  relevant issues/PRs/evidence, and limitations or accepted deferrals.
- Link an issue with `Closes #N` only when completing that actual issue.
  Reference a related PR with a normal link; PR numbers are not issue-closing
  instructions. An initial PR number need not be known to write complete docs.
- For an existing PR, approved pushes update its commits. Propose description
  updates if its scope or verification summary has changed; edit metadata only
  with approval. Replies should identify the fix and evidence in the existing
  thread. Resolve threads only when authorized.

## 5. Final merge handoff

Repeat this gate after the last relevant review change, not just at PR creation:

- The agreed scope is implemented and verified; remaining findings have an
  explicit disposition. No required acceptance is silently deferred.
- All affected docs are accurate for the branch and will be accurate on `main`
  when merged. Completed work has its final outcome, not an old "in review"
  narrative or obsolete next action. No merge SHA placeholder remains.
- Accepted deferrals have a durable reference. The maintainer's next substantive
  decision is clear without making review/merge mechanics into roadmap work.
- Intended commits and docs are pushed, required checks pass on the PR head,
  and the final summary names the PR, results, and remaining limitations.

Hand the existing PR to the maintainer. Do not declare it merged or deployed.
New feedback reopens only the affected parts of this checklist.

## 6. After merge

Verify the GitHub merge and perform only authorized local/remote branch cleanup.
Fast-forward local `main` to the verified remote result without overwriting work.
Check integration before deletion, accounting for merge, squash, or rebase.
Report completion in the conversation. Do not create a routine follow-up PR to
flip a status or add a merge SHA; all required outcome docs belong in the PR
that delivered the work. A genuinely new documentation correction is still
valid work and must follow the normal PR process.
