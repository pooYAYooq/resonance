<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Git Commit Messages

When generating git commit messages, follow these rules **strictly**:

### Format

Use the **Conventional Commits** format with a subject line and a body:

```
<type>(<optional scope>): <short imperative summary>

<body — wrap at 72 characters per line>
```

### Subject Line (title)

- Start with a **type** prefix: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`, or `ci`.
- Optionally add a **scope** in parentheses to indicate the affected area (e.g., `feat(auth):`, `fix(api):`).
- Write in the **imperative mood** — "Add feature", not "Added feature" or "Adds feature".
- Keep it **under 72 characters**.
- Do **not** end with a period.
- Use correct **English grammar and spelling**.

### Body

- Always include a body unless the change is completely trivial (e.g., a typo fix in a single line).
- Separate the subject line from the body with a **blank line**.
- Explain **what** changed and **why** — not just how. The diff already shows how.
- Describe the **motivation** for the change, and contrast it with previous behavior when relevant.
- Wrap lines at **72 characters**.
- Use **full sentences** with correct grammar and punctuation.
- Use bullet points (`-`) for listing multiple distinct changes within the same commit.

### Examples

**Simple single-change commit:**
```
fix(auth): redirect to login when session expires

Previously, expired sessions caused a blank page to appear because the
auth guard was not redirecting unauthenticated users. This change adds
an explicit redirect to /login whenever the session token is missing or
invalid.
```

**Multi-change commit:**
```
feat(dashboard): add real-time activity feed and unread badge

- Introduces a live activity feed on the dashboard that streams events
  from Convex in real time, replacing the previous polling mechanism.
- Adds an unread-count badge to the navigation icon so users can see
  pending activity without opening the panel.
- Extracts the feed item renderer into a reusable ActivityItem component
  to keep the dashboard component focused on layout.
```
