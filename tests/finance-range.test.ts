import assert from "node:assert/strict";
import test from "node:test";
import { getMonthRange, getWeekRange } from "@/lib/financials";
import { resolveFinanceRange } from "@/lib/financeReports";

test("week range uses the current Monday through Sunday", () => {
  const { start, end } = getWeekRange(new Date("2026-04-10T12:00:00-03:00"));

  assert.equal(start.toLocaleDateString("pt-BR"), "06/04/2026");
  assert.equal(end.toLocaleDateString("pt-BR"), "12/04/2026");
});

test("month range keeps the full current month", () => {
  const { start, end } = getMonthRange(new Date("2026-04-10T12:00:00-03:00"));

  assert.equal(start.toLocaleDateString("pt-BR"), "01/04/2026");
  assert.equal(end.toLocaleDateString("pt-BR"), "30/04/2026");
});

test("finance range defaults to week when period is omitted", () => {
  const range = resolveFinanceRange({});
  const daysInRange =
    (range.end.getTime() - range.start.getTime() + 1) / (1000 * 60 * 60 * 24);

  assert.equal(range.period, "week");
  assert.ok(daysInRange <= 7);
});
