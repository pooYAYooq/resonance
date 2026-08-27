import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FollowerGrowthPoint = {
  dayStart: number;
  gainedCount: number;
};

const accessibleDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const visualDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const visualLabelIndices = new Set([0, 7, 14, 21, 29]);

function formatAccessibleDay(dayStart: number) {
  return accessibleDateFormatter.format(dayStart);
}

function formatVisualDay(dayStart: number) {
  return visualDateFormatter.format(dayStart);
}

function formatFollowerGain(gainedCount: number) {
  return `${gainedCount} new follower${gainedCount === 1 ? "" : "s"}`;
}

export function FollowerGrowthChart({
  points,
}: {
  points: FollowerGrowthPoint[];
}) {
  const maximumDailyGain = Math.max(
    ...points.map((point) => point.gainedCount),
    0,
  );
  const scaleMax = Math.max(5, maximumDailyGain);
  const hasGrowth = maximumDailyGain > 0;

  return (
    <Card aria-labelledby="follower-growth-title">
      <CardHeader>
        <CardTitle>
          <h3 id="follower-growth-title">Follower growth</h3>
        </CardTitle>
        <CardDescription>Last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div aria-hidden="true" className="flex flex-col gap-2">
          <TooltipProvider>
            <div className="flex h-40 items-end gap-1 border-b border-border px-1">
              {points.map((point) => {
                const height = (point.gainedCount / scaleMax) * 100;
                const isZero = point.gainedCount === 0;
                const barHeight = isZero ? "0.25rem" : `${height}%`;

                return (
                  <Tooltip key={point.dayStart}>
                    <TooltipTrigger asChild>
                      <div
                        data-slot="follower-growth-bar"
                        className={`min-w-0 flex-1 rounded-t-sm transition-colors ${
                          isZero
                            ? "bg-muted-foreground/25"
                            : "bg-primary/80 hover:bg-primary"
                        }`}
                        style={{ height: barHeight }}
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      aria-hidden="true"
                      side="top"
                      sideOffset={8}
                      collisionPadding={12}
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold">
                          {formatFollowerGain(point.gainedCount)}
                        </p>
                        <p className="text-background/70">
                          {tooltipDateFormatter.format(point.dayStart)}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
          <div className="flex justify-between gap-1 px-1 text-xs text-muted-foreground">
            {points
              .filter((_, index) => visualLabelIndices.has(index))
              .map((point) => (
                <span
                  key={point.dayStart}
                  data-slot="follower-growth-date-label"
                >
                  {formatVisualDay(point.dayStart)}
                </span>
              ))}
          </div>
        </div>
        {!hasGrowth && (
          <p className="mt-4 text-sm text-muted-foreground">
            No new followers in this period
          </p>
        )}
        <ul
          className="sr-only"
          aria-label="Daily follower growth for the last 30 days"
        >
          {points.map((point) => (
            <li key={point.dayStart}>
              {formatAccessibleDay(point.dayStart)}: {point.gainedCount}{" "}
              follower{point.gainedCount === 1 ? "" : "s"} gained
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
