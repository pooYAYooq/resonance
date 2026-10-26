import { describe, expect, it } from "vitest";
import { groupCollectionPostsByTime } from "./collection-time-groups";

const now = new Date(2026, 9, 26, 12, 0, 0).getTime();

function daysAgo(days: number, hour = 12): number {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

function post(id: string, addedAt: number) {
  return { id, addedAt };
}

describe("groupCollectionPostsByTime", () => {
  it("groups rolling windows in order and preserves input order", () => {
    const groups = groupCollectionPostsByTime(
      [
        post("today-a", daysAgo(0)),
        post("today-b", daysAgo(0, 8)),
        post("yesterday", daysAgo(1)),
        post("seven-days", daysAgo(7)),
        post("eight-days", daysAgo(8)),
        post("thirty-days", daysAgo(30)),
        post("older", daysAgo(31)),
      ],
      now,
    );

    expect(
      groups.map((group) => [group.key, group.posts.map((item) => item.id)]),
    ).toEqual([
      ["today", ["today-a", "today-b"]],
      ["yesterday", ["yesterday"]],
      ["previous-7-days", ["seven-days"]],
      ["previous-30-days", ["eight-days", "thirty-days"]],
      ["earlier", ["older"]],
    ]);
  });

  it("omits empty buckets", () => {
    const groups = groupCollectionPostsByTime([post("today", daysAgo(0))], now);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: "today",
      label: "Today",
    });
  });

  it("puts midnight boundaries in the earlier bucket", () => {
    const groups = groupCollectionPostsByTime(
      [
        post("today-start", daysAgo(0, 0)),
        post("yesterday-start", daysAgo(1, 0)),
        post("seven-start", daysAgo(7, 0)),
        post("thirty-start", daysAgo(30, 0)),
        post("before-thirty", daysAgo(31, 23)),
      ],
      now,
    );

    expect(
      groups.map((group) => [group.key, group.posts.map((item) => item.id)]),
    ).toEqual([
      ["today", ["today-start"]],
      ["yesterday", ["yesterday-start"]],
      ["previous-7-days", ["seven-start"]],
      ["previous-30-days", ["thirty-start"]],
      ["earlier", ["before-thirty"]],
    ]);
  });

  it("returns no groups for an empty collection", () => {
    expect(groupCollectionPostsByTime([], now)).toEqual([]);
  });
});
