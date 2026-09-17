import { getVipDueDateForCycle, resolveVipPolicyDueDate } from "./vipDueDate";

// Historical PAID records remain settled regardless of when payment was entered.
// Freeze the first renewal at cutover so later retries cannot move it forward.
export function resolveVipMigrationDueDate(dueDay: number, payments: Array<{ cycleMonth: string; status: string }>, today: string) {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new Error("Vencimento inválido.");
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const legacyDueDate = new Date(Date.UTC(year, month - 1, Math.min(dueDay, lastDay), 12));
  const paid = payments.some(payment => payment.cycleMonth === today.slice(0, 7) && payment.status === "PAID");
  if (legacyDueDate.toISOString().slice(0, 10) < today) {
    if (!paid) return legacyDueDate;
    const nextCycle = new Date(Date.UTC(year, month, 1, 12)).toISOString().slice(0, 7);
    return getVipDueDateForCycle(nextCycle, dueDay);
  }
  return getVipDueDateForCycle(today.slice(0, 7), dueDay);
}

// Only the access carried over at the actual September 16 deployment expires.
// This is deliberately not a general rule based on paidAt < dueDate: customers
// may pay early, and already settled historical cycles must never be reopened.
const LEGACY_CUTOVER = "2026-09-16T06:02:19.000Z";

export function shouldExpireLegacyRenewal(
  payment: {
    status: string;
    paidAt: Date | null;
    asaasPaymentId: string | null;
  } | undefined,
  renewalDueDate: Date,
  today: string
) {
  return (
    renewalDueDate.toISOString().slice(0, 10) >= LEGACY_CUTOVER.slice(0, 10) &&
    renewalDueDate.toISOString().slice(0, 10) < today &&
    payment?.status === "PAID" &&
    !payment.asaasPaymentId &&
    Boolean(payment.paidAt && payment.paidAt.toISOString() < LEGACY_CUTOVER) &&
    // A later month's payment cannot be mistaken for the migration's carryover.
    renewalDueDate.toISOString().slice(0, 7) === LEGACY_CUTOVER.slice(0, 7)
  );
}

export function isVipRenewalPaymentSettled(
  payment: {
    status: string;
    paidAt: Date | null;
    asaasPaymentId: string | null;
  } | undefined
) {
  return payment?.status === "PAID";
}

export function resolveAsaasRecurringDueDate(firstDueDate: Date, dueDay: number, today: string) {
  const firstValue = firstDueDate.toISOString().slice(0, 10);
  if (firstValue >= today) return resolveVipPolicyDueDate(firstDueDate, dueDay, today);

  const [year, month] = today.split("-").map(Number);
  let candidate = getVipDueDateForCycle(today.slice(0, 7), dueDay);
  if (candidate.toISOString().slice(0, 10) < today) {
    const nextCycle = new Date(Date.UTC(year, month, 1, 12)).toISOString().slice(0, 7);
    candidate = getVipDueDateForCycle(nextCycle, dueDay);
  }
  return candidate;
}

export function safeAsaasInvoiceUrl(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && (url.hostname === "asaas.com" || url.hostname.endsWith(".asaas.com")) ? url.href : null;
  } catch { return null; }
}
