import { describe, expect, it } from "vitest";
import { parseRoute, routeHash } from "../../src/lib/hooks";

describe("screen addresses", () => {
  it("round-trips every screen and falls back to Today", () => {
    for (const r of [{ tab: "today" }, { tab: "days" }, { tab: "days", month: "2026-11" }, { tab: "day", date: "2026-11-24" }, { tab: "settings" }] as const) {
      expect(parseRoute(routeHash(r))).toEqual(r);
    }
    expect(parseRoute("")).toEqual({ tab: "today" });
    expect(parseRoute("#day-<script>")).toEqual({ tab: "today" });
  });
});
