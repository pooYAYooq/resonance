import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("./check-artifacts.mjs", import.meta.url));

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), "resonance-artifacts-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd });
  git("init", "--quiet");
  const add = (path) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), "fixture\n");
    git("add", "--", path);
  };
  const check = () =>
    spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
  return { cwd, git, add, check };
}

test("allows source, curated evidence, and product images", (t) => {
  const { add, check } = repository(t);
  for (const path of [
    "docs/ACCESSIBILITY.md",
    "app/page.tsx",
    "public/cover.png",
  ])
    add(path);
  assert.equal(check().status, 0);
});

test("rejects local artifacts even when already committed", (t) => {
  const { git, add, check } = repository(t);
  add("docs/superpowers/plans/old plan.md");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-qm",
    "fixture",
  );
  const result = check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /docs\/superpowers\/plans\/old plan.md/);
});

for (const path of [
  ".superpowers/session.md",
  ".playwright-cli/page.yml",
  "test-results/run/trace.zip",
  "playwright-report/index.html",
  "NOTES.local.md",
  "NOTES.local/note.md",
  "TODO.local.md",
  "docs/superpowers/line\nbreak.md",
]) {
  test(`rejects staged artifact ${JSON.stringify(path)}`, (t) => {
    const { add, check } = repository(t);
    add(path);
    const result = check();
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(JSON.stringify(path)));
  });
}

test("ignore rules exclude artifacts from broad staging and forced additions fail the check", (t) => {
  const { cwd, git, check } = repository(t);
  copyFileSync(
    new URL("../.gitignore", import.meta.url),
    join(cwd, ".gitignore"),
  );
  const path = "docs/superpowers/plans/local.md";
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), "local plan\n");
  git("add", "--all");
  assert.equal(check().status, 0);
  assert.ok(!git("ls-files").toString().includes(path));
  git("add", "--force", "--", path);
  assert.equal(check().status, 1);
});

test("allows removing an artifact from the index while keeping its local copy", (t) => {
  const { git, add, check } = repository(t);
  add("docs/superpowers/local.md");
  git("rm", "--cached", "--", "docs/superpowers/local.md");
  assert.equal(check().status, 0);
});

test("checks root-relative paths when invoked from a subdirectory", (t) => {
  const { cwd, add } = repository(t);
  add("docs/superpowers/local.md");
  mkdirSync(join(cwd, "nested"));
  const result = spawnSync(process.execPath, [script], {
    cwd: join(cwd, "nested"),
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /docs\/superpowers\/local.md/);
});

test("fails closed outside a Git repository", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "resonance-no-git-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [script], {
    cwd,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot inspect Git index/);
});
