/**
 * Component tests for the shared `EmptyState` primitive.
 *
 * Verifies the icon, title, description, and optional CTA action
 * render with the expected structure and that omitted slots are
 * not rendered.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

function makeIcon(testId: string) {
  function Icon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        data-testid={testId}
        className={props.className}
        strokeWidth={props.strokeWidth}
        aria-hidden="true"
      />
    );
  }
  Icon.displayName = testId;
  return Icon;
}

describe("EmptyState", () => {
  it("renders the icon", () => {
    const Icon = makeIcon("empty-icon");
    render(
      <EmptyState
        icon={Icon}
        title="No posts yet"
        description="When this user publishes a post, it will appear here."
      />,
    );
    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
  });

  it("renders the title", () => {
    const Icon = makeIcon("empty-icon");
    render(
      <EmptyState
        icon={Icon}
        title="No posts yet"
        description="When this user publishes a post, it will appear here."
      />,
    );
    expect(screen.getByText("No posts yet")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    const Icon = makeIcon("empty-icon");
    render(
      <EmptyState
        icon={Icon}
        title="No posts yet"
        description="When this user publishes a post, it will appear here."
      />,
    );
    expect(
      screen.getByText(/when this user publishes a post/i),
    ).toBeInTheDocument();
  });

  it("does not render the description when omitted", () => {
    const Icon = makeIcon("empty-icon");
    const { container } = render(
      <EmptyState icon={Icon} title="No posts yet" />,
    );
    expect(
      screen.queryByText(/when this user publishes a post/i),
    ).not.toBeInTheDocument();
    // Only the title <p> is rendered; no description <p>.
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toHaveTextContent("No posts yet");
  });

  it("renders the action when provided", () => {
    const Icon = makeIcon("empty-icon");
    render(
      <EmptyState
        icon={Icon}
        title="No posts yet"
        description="When this user publishes a post, it will appear here."
        action={<button type="button">Write a post</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: /write a post/i }),
    ).toBeInTheDocument();
  });

  it("does not render the action when omitted", () => {
    const Icon = makeIcon("empty-icon");
    render(
      <EmptyState
        icon={Icon}
        title="No posts yet"
        description="When this user publishes a post, it will appear here."
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
