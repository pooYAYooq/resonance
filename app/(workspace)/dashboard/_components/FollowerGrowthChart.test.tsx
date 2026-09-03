import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowerGrowthChart } from "./FollowerGrowthChart";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverMock,
});

const asOfDayStart = Date.UTC(2026, 7, 27);
const UTC_DAY_MS = 24 * 60 * 60 * 1000;
const points = Array.from({ length: 30 }, (_, index) => ({
  dayStart: asOfDayStart - (29 - index) * UTC_DAY_MS,
  gainedCount: index === 29 ? 6 : index === 12 ? 3 : index === 27 ? 1 : 0,
}));

describe("FollowerGrowthChart", () => {
  it("renders the chart and one screen-reader representation of all days", () => {
    render(<FollowerGrowthChart points={points} />);

    expect(
      screen.getByRole("heading", { name: "Follower growth" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();

    const dailyValues = screen.getByRole("list", {
      name: "Daily follower growth for the last 30 days",
    });
    expect(dailyValues.querySelectorAll("li")).toHaveLength(30);
    expect(dailyValues).toHaveTextContent(
      "August 27, 2026: 6 followers gained",
    );
    expect(dailyValues).toHaveTextContent(
      "August 25, 2026: 1 follower gained",
    );

    const visualChart = document.querySelector('[aria-hidden="true"]');
    expect(visualChart).toBeInTheDocument();
    expect(
      visualChart?.querySelectorAll('[data-slot="follower-growth-bar"]'),
    ).toHaveLength(30);

    const visualLabels = visualChart?.querySelectorAll(
      '[data-slot="follower-growth-date-label"]',
    );
    expect(visualLabels).toHaveLength(5);
    expect(Array.from(visualLabels!).map((label) => label.textContent)).toEqual(
      ["Jul 29", "Aug 5", "Aug 12", "Aug 19", "Aug 27"],
    );
    expect(visualLabels![0].parentElement).toHaveClass("justify-between");
  });

  it("scales bars to the current maximum and keeps zero bars neutral", () => {
    render(<FollowerGrowthChart points={points} />);

    const bars = Array.from(
      document.querySelectorAll(
        '[aria-hidden="true"] [data-slot="follower-growth-bar"]',
      ),
    );

    expect(bars[29]).toHaveStyle({ height: "100%" });
    expect(bars[12]).toHaveStyle({ height: "50%" });
    expect(bars[27]).toHaveStyle({ height: "16.666666666666664%" });
    expect(bars[0]).toHaveStyle({ height: "0.25rem" });
    expect(bars[0]).toHaveClass("bg-muted-foreground/25");
    expect(bars[29]).toHaveClass("bg-primary/80", "hover:bg-primary");
  });

  it("uses a minimum scale ceiling for small maxima and emphasizes hovered bars", () => {
    render(
      <FollowerGrowthChart
        points={points.map((point) => ({
          ...point,
          gainedCount: point.gainedCount === 1 ? 1 : 0,
        }))}
      />,
    );

    const bars = Array.from(
      document.querySelectorAll(
        '[aria-hidden="true"] [data-slot="follower-growth-bar"]',
      ),
    );

    expect(bars[27]).toHaveStyle({ height: "20%" });
    expect(bars[27]).toHaveClass("bg-primary/80", "hover:bg-primary");
  });

  it("shows exact pointer-only tooltip values without making bars focusable", async () => {
    const user = userEvent.setup();
    render(<FollowerGrowthChart points={points} />);

    const bars = document.querySelectorAll(
      '[aria-hidden="true"] [data-slot="follower-growth-bar"]',
    );
    expect(Array.from(bars).every((bar) => !bar.hasAttribute("tabindex"))).toBe(
      true,
    );

    await user.hover(bars[29]);
    const pluralGain = (await screen.findAllByText("6 new followers"))[0];
    expect(pluralGain).toBeInTheDocument();
    expect(screen.getAllByText("Thursday, Aug 27")[0]).toBeInTheDocument();
    expect(pluralGain.closest('[data-slot="tooltip-content"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("uses singular follower grammar in the pointer tooltip", async () => {
    const user = userEvent.setup();
    render(<FollowerGrowthChart points={points} />);

    const bars = document.querySelectorAll(
      '[aria-hidden="true"] [data-slot="follower-growth-bar"]',
    );
    await user.hover(bars[27]);
    expect(
      (await screen.findAllByText("1 new follower"))[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText("Tuesday, Aug 25")[0]).toBeInTheDocument();
  });

  it("keeps the chart visible and explains an all-zero period", () => {
    render(
      <FollowerGrowthChart
        points={points.map((point) => ({ ...point, gainedCount: 0 }))}
      />,
    );

    expect(
      screen.getByText("No new followers in this period"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", {
        name: "Daily follower growth for the last 30 days",
      }),
    ).toHaveTextContent(": 0 followers gained");

    const zeroBars = document.querySelectorAll(
      '[aria-hidden="true"] [data-slot="follower-growth-bar"]',
    );
    expect(zeroBars).toHaveLength(30);
    expect(
      Array.from(zeroBars).every(
        (bar) => bar.getAttribute("style") === "height: 0.25rem;",
      ),
    ).toBe(true);
  });
});
