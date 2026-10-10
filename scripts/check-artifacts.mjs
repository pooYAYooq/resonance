import { execFileSync } from "node:child_process";

// Keep these known local-only paths aligned with .gitignore. Arbitrarily named
// artifacts still require human diff inspection; product assets are allowed.
const directories = [
  "docs/superpowers/",
  ".superpowers/",
  ".playwright-cli/",
  "playwright-report/",
  "test-results/",
  "NOTES.local/",
];
const files = new Set(["NOTES.local.md", "TODO.local.md"]);

try {
  const paths = execFileSync(
    "git",
    ["ls-files", "--cached", "--full-name", "-z", "--", ":/"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    },
  )
    .split("\0")
    .filter(Boolean);
  const artifacts = paths.filter(
    (path) =>
      files.has(path) ||
      directories.some(
        (directory) =>
          path.startsWith(directory) || path === directory.slice(0, -1),
      ),
  );

  if (artifacts.length) {
    console.error("Local task artifacts are present in the Git index:");
    for (const path of artifacts) console.error(`  ${JSON.stringify(path)}`);
    console.error(
      "Keep these files outside the committed tree. Inspect the index before removing them; preserve local work.",
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Artifact check passed: no known local-only paths in the Git index.",
    );
  }
} catch (error) {
  console.error(`Cannot inspect Git index: ${error.message}`);
  process.exitCode = 1;
}
