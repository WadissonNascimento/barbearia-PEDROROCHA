// Historical PAID records remain settled regardless of when payment was entered.
// Freeze the first renewal at cutover so later retries cannot move it forward.
export function resolveVipMigrationDueDate(dueDay: number, payments: Array<{ cycleMonth: string; status: string }>, today: string) {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new Error("Vencimento inválido.");
  const [year, month] = today.split("-").map(Number);
  const due = (y: number, m: number) => new Date(Date.UTC(y, m - 1, Math.min(dueDay, new Date(Date.UTC(y, m, 0)).getUTCDate()), 12));
  const current = due(year, month);
  const paid = payments.some(payment => payment.cycleMonth === today.slice(0, 7) && payment.status === "PAID");
  return current.toISOString().slice(0, 10) < today && paid ? due(year, month + 1) : current;
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
  if (firstValue >= today) return firstDueDate;

  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let candidate = new Date(Date.UTC(year, month - 1, Math.min(dueDay, lastDay), 12));
  if (candidate.toISOString().slice(0, 10) < today) {
    const nextLastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    candidate = new Date(Date.UTC(year, month, Math.min(dueDay, nextLastDay), 12));
  }
  return candidate;
}

export function safeAsaasInvoiceUrl(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && (url.hostname === "asaas.com" || url.hostname.endsWith(".asaas.com")) ? url.href : null;
  } catch { return null; }
}
