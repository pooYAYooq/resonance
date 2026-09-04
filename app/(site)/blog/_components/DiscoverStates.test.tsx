import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DiscoverResultsSkeleton,
  DiscoverTopicsSkeleton,
} from "./DiscoverStates";

describe("DiscoverStates", () => {
  it("provides separate loading boundaries for results and topics", () => {
    render(
      <>
        <DiscoverResultsSkeleton />
        <DiscoverTopicsSkeleton />
      </>,
    );
    expect(screen.getByTestId("discover-results-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("discover-topics-skeleton")).toBeInTheDocument();
  });
});
