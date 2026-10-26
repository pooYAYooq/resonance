import { afterEach, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { CommentTimestamp } from "./CommentTimestamp";
afterEach(() => vi.restoreAllMocks());
it("hydrates a deterministic UTC timestamp before displaying browser-local time", async () => {
  vi.spyOn(Date.prototype, "toLocaleTimeString").mockImplementation(
    (_locale, options) =>
      options?.timeZone === "UTC" ? "UTC time" : "Local time",
  );
  const host = document.createElement("div");
  host.innerHTML = renderToString(
    <CommentTimestamp createdAt={1_700_000_000_000} />,
  );
  expect(host.textContent).toContain("UTC time");
  document.body.append(host);
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(
      host,
      <CommentTimestamp createdAt={1_700_000_000_000} />,
      { onRecoverableError },
    );
  });
  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Local time");
  await act(async () => root.unmount());
  host.remove();
});
