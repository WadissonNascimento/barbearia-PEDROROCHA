import test from "node:test";
import assert from "node:assert/strict";
import { resolveAsaasRecurringDueDate, resolveVipMigrationDueDate, shouldExpireLegacyRenewal, isVipRenewalPaymentSettled, safeAsaasInvoiceUrl } from "../lib/vipMigration";

const legacyPaid = { status: "PAID", paidAt: new Date("2026-09-04T15:12:00Z"), asaasPaymentId: null };
const septemberPaid = [{ cycleMonth: "2026-09", status: "PAID" }];

test("Historical paid renewals stay paid even if entered before their due day", () => {
  for (const day of [5, 13, 15]) {
    const nextDueDay = day === 5 ? 6 : day;
    assert.equal(resolveVipMigrationDueDate(day, septemberPaid, "2026-09-16").toISOString().slice(0, 10), `2026-10-${String(nextDueDay).padStart(2, "0")}`);
    assert.equal(shouldExpireLegacyRenewal(legacyPaid, new Date(`2026-09-${String(day).padStart(2, "0")}T12:00:00Z`), "2026-09-17"), false);
  }
  assert.equal(isVipRenewalPaymentSettled(legacyPaid), true);
});
test("The two previously pending renewals remain due September 5", () => {
  assert.equal(resolveVipMigrationDueDate(5, [{ cycleMonth: "2026-09", status: "PENDING" }], "2026-09-16").toISOString().slice(0, 10), "2026-09-05");
  assert.equal(isVipRenewalPaymentSettled({ ...legacyPaid, status: "PENDING" }), false);
});
test("Adriel's frozen September 16 renewal expires on September 17", () => {
  const due = resolveVipMigrationDueDate(16, septemberPaid, "2026-09-16");
  assert.equal(due.toISOString().slice(0, 10), "2026-09-16");
  assert.equal(shouldExpireLegacyRenewal(legacyPaid, due, "2026-09-16"), false);
  assert.equal(shouldExpireLegacyRenewal(legacyPaid, due, "2026-09-17"), true);
});
test("Upcoming cutover renewals expire only after their due date", () => {
  for (const [day, expires] of [[20, "2026-09-21"], [30, "2026-10-01"]] as const) {
    const due = resolveVipMigrationDueDate(day, septemberPaid, "2026-09-16");
    assert.equal(shouldExpireLegacyRenewal(legacyPaid, due, due.toISOString().slice(0, 10)), false);
    assert.equal(shouldExpireLegacyRenewal(legacyPaid, due, expires), true);
  }
});
test("New early payments, provider payments and later cycles are never expired by cutover", () => {
  const due = new Date("2026-09-20T12:00:00Z");
  assert.equal(shouldExpireLegacyRenewal({ ...legacyPaid, paidAt: new Date("2026-09-18T10:00:00Z") }, due, "2026-09-21"), false);
  assert.equal(shouldExpireLegacyRenewal({ ...legacyPaid, asaasPaymentId: "pay_123" }, due, "2026-09-21"), false);
  assert.equal(shouldExpireLegacyRenewal(legacyPaid, new Date("2026-10-05T12:00:00Z"), "2026-10-06"), false);
});
test("Month ends and overdue recurring dates remain valid", () => {
  assert.equal(resolveVipMigrationDueDate(31, [], "2026-02-15").toISOString().slice(0, 10), "2026-02-28");
  assert.equal(resolveVipMigrationDueDate(5, [{ cycleMonth: "2026-12", status: "PAID" }], "2026-12-15").toISOString().slice(0, 10), "2027-01-07");
  assert.equal(resolveAsaasRecurringDueDate(new Date("2026-09-05T12:00:00Z"), 5, "2026-09-17").toISOString().slice(0, 10), "2026-10-06");
});
test("existing unpaid debts retain their historical day even where business day differs", () => {
  assert.equal(resolveVipMigrationDueDate(5, [{ cycleMonth: "2026-02", status: "PENDING" }], "2026-02-10").toISOString().slice(0, 10), "2026-02-05");
});
test("future renewals use the fifth business day without an additional month jump on the due date", () => {
  const firstDue = new Date("2026-10-05T12:00:00Z");
  assert.equal(resolveAsaasRecurringDueDate(firstDue, 5, "2026-09-17").toISOString().slice(0, 10), "2026-10-06");
  assert.equal(resolveAsaasRecurringDueDate(firstDue, 5, "2026-10-06").toISOString().slice(0, 10), "2026-10-06");
  assert.equal(resolveAsaasRecurringDueDate(firstDue, 5, "2026-10-07").toISOString().slice(0, 10), "2026-11-07");
});
test("Only HTTPS Asaas invoice URLs are exposed", () => {
  assert.equal(safeAsaasInvoiceUrl("https://www.asaas.com/i/test"), "https://www.asaas.com/i/test");
  assert.equal(safeAsaasInvoiceUrl("https://asaas.com.evil.test/"), null);
  assert.equal(safeAsaasInvoiceUrl("javascript:alert(1)"), null);
});
