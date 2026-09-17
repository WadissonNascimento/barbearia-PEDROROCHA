import test from "node:test";
import assert from "node:assert/strict";
import {
  getVipDueDateForCycle,
  getVipDueDayLabel,
  isVipBillingBusinessDay,
  resolveVipPolicyDueDate,
} from "../lib/vipDueDate";

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

test("day 5 means the fifth business day, including Saturdays", () => {
  assert.equal(dateValue(getVipDueDateForCycle("2026-09", 5)), "2026-09-05");
  assert.equal(dateValue(getVipDueDateForCycle("2026-10", 5)), "2026-10-06");
  assert.equal(dateValue(getVipDueDateForCycle("2026-11", 5)), "2026-11-07");
  assert.equal(isVipBillingBusinessDay(new Date("2026-09-05T12:00:00Z")), true);
  assert.equal(isVipBillingBusinessDay(new Date("2026-09-06T12:00:00Z")), false);
});

test("the 2026 calendar skips national holidays and Good Friday", () => {
  const expectedDays = [7, 6, 6, 7, 7, 5, 6, 6, 5, 6, 7, 5];
  for (let month = 1; month <= 12; month += 1) {
    const cycle = `2026-${String(month).padStart(2, "0")}`;
    assert.equal(
      dateValue(getVipDueDateForCycle(cycle)),
      `${cycle}-${String(expectedDays[month - 1]).padStart(2, "0")}`
    );
  }
  for (const holiday of ["01-01", "04-03", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"]) {
    assert.equal(isVipBillingBusinessDay(new Date(`2026-${holiday}T12:00:00Z`)), false);
  }
});

test("movable Good Friday is recalculated; optional federal holidays are not skipped", () => {
  assert.equal(isVipBillingBusinessDay(new Date("2027-03-26T12:00:00Z")), false);
  assert.equal(isVipBillingBusinessDay(new Date("2028-04-14T12:00:00Z")), false);
  assert.equal(isVipBillingBusinessDay(new Date("2026-02-17T12:00:00Z")), true);
  assert.equal(isVipBillingBusinessDay(new Date("2026-06-04T12:00:00Z")), true);
});

test("all other due days retain their calendar date, with month-end clamping", () => {
  assert.equal(dateValue(getVipDueDateForCycle("2026-09", 20)), "2026-09-20");
  assert.equal(dateValue(getVipDueDateForCycle("2026-09", 7)), "2026-09-07");
  assert.equal(dateValue(getVipDueDateForCycle("2026-02", 31)), "2026-02-28");
  assert.equal(dateValue(getVipDueDateForCycle("2028-02", 31)), "2028-02-29");
});

test("upcoming day-5 invoices move to the new calendar, historical debt dates do not", () => {
  const future = new Date("2026-10-05T12:00:00Z");
  const debt = new Date("2026-02-05T12:00:00Z");
  assert.equal(dateValue(resolveVipPolicyDueDate(future, 5, "2026-09-17")), "2026-10-06");
  assert.equal(resolveVipPolicyDueDate(debt, 5, "2026-02-06"), debt);
  assert.equal(resolveVipPolicyDueDate(future, 20, "2026-09-17"), future);
  const laterInvoice = new Date("2026-09-08T12:00:00Z");
  assert.equal(resolveVipPolicyDueDate(laterInvoice, 5, "2026-09-06"), laterInvoice);
});

test("calendar labels and invalid input are explicit", () => {
  assert.equal(getVipDueDayLabel(5), "5º dia útil");
  assert.equal(getVipDueDayLabel(20), "dia 20");
  for (const cycle of ["2026-00", "2026-13", "2026-9", "invalid"]) {
    assert.throws(() => getVipDueDateForCycle(cycle, 5));
  }
  for (const day of [0, -1, 32, 5.5, NaN]) {
    assert.throws(() => getVipDueDateForCycle("2026-09", day));
  }
});
