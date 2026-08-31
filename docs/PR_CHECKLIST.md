# Local PR Checklist

Use this checklist before requesting approval to open a pull request. It is intentionally a local agent workflow document, not a GitHub PR template.

1. Confirm the working tree contains only intended task changes plus any intentionally local, untracked planning artifacts.
2. Read `docs/status.md` and verify the current delivery focus and next task are accurate.
3. Mark completed plan steps and record any known limitations.
4. Update `FEATURES.md` when tracked roadmap or delivery status changed; maintain exactly one item as `🔵 up next`.
5. Update `docs/status.md` in the same change when the project resume point changed.
6. Update `README.md` and `docs/ARCHITECTURE.md` only when their documented shipped behavior or architecture actually changed.
7. Run the required verification commands from `AGENTS.md` and report the actual results.
8. Review the full branch diff and recent commits for unrelated files, secrets, stale documentation, accidental planning-file inclusion, generated changes, and naming-policy violations.
9. Verify the proposed PR title is clear, outcome-based, and contains no phase, step, task, or slice number.
10. Confirm that all required earlier staging and commit gates were explicitly
    approved. Stop for the separate human approval required before pushing.
11. Push the approved non-`main` branch only after explicit push approval. Then
    stop again for the separate human approval required before creating or
    updating the PR.
