# Local PR Checklist

Use this checklist before opening a pull request. It is intentionally a local
agent workflow document, not a GitHub PR template.

1. Confirm the working tree contains only intended changes.
2. Read `docs/status.md` and verify the current phase and next task are accurate.
3. Mark completed plan steps and record any known limitations.
4. Update `FEATURES.md` when a task or phase shipped; mark exactly one next item
   as `🔵 up next`.
5. Update `docs/status.md` in the same change as the implementation.
6. Update `README.md` and `docs/ARCHITECTURE.md` when structure, schema, auth,
   or user-facing behavior changed.
7. Run the required verification commands from `AGENTS.md` and report actual
   results.
8. Review the branch diff and recent commits for unrelated files, secrets,
   stale documentation, and uncommitted generated changes.
9. Push the feature branch and open the PR only after all preceding checks are
   complete.
