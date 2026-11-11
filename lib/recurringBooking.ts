import { z } from "zod";

export const MAX_RECURRING_VISITS = 12;
export const MAX_RECURRING_DAYS = 180;
export const RECURRING_INTERVALS = [7, 14, 15] as const;

export type RecurringOccurrence = { date: string; time: string };

export function isValidRecurringDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addRecurringDays(value: string, days: number) {
  if (!isValidRecurringDate(value) || !Number.isInteger(days)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function generateRecurringDates(start: string, interval: number, count: number) {
  if (!isValidRecurringDate(start) || !RECURRING_INTERVALS.includes(interval as never) || !Number.isInteger(count) || count < 2 || count > MAX_RECURRING_VISITS) return [];
  return Array.from({ length: count }, (_, index) => addRecurringDays(start, interval * index));
}

export function recurringDatesInRange(dates: string[], today: string) {
  const last = addRecurringDays(today, MAX_RECURRING_DAYS);
  return dates.every((date) => isValidRecurringDate(date) && date >= today && date <= last);
}

const dateSchema = z.string().refine(isValidRecurringDate, "Data inválida.");
const ids = z.array(z.string().trim().min(1).max(200)).max(8).refine((values) => new Set(values).size === values.length);

export const recurringContextSchema = z.object({
  customerId: z.string().trim().min(1).max(200).optional(),
  customerName: z.string().trim().max(80).regex(/^[^|\r\n]*$/, "Nome inválido.").optional(),
  customerPhone: z.string().trim().max(30).optional(),
  barberId: z.string().trim().min(1).max(200),
  serviceIds: ids,
  useVipPlan: z.boolean().optional().default(false),
});

function validCustomer(data: { customerId?: string; customerName?: string }) {
  return data.customerId ? !data.customerName : Boolean(data.customerName && data.customerName.length >= 2);
}

export const recurringPreviewSchema = recurringContextSchema.extend({
  dates: z.array(dateSchema).min(2).max(MAX_RECURRING_VISITS).refine((values) => new Set(values).size === values.length),
}).refine(validCustomer, "Selecione um cliente cadastrado ou informe o nome.")
  .refine((data) => !data.useVipPlan || data.serviceIds.length === 0, "Escolha o item do plano ou serviços avulsos, não os dois juntos.");

export const recurringBookingSchema = recurringContextSchema.extend({
  repeatForever: z.boolean().optional().default(false),
  intervalDays: z.union([z.literal(7), z.literal(14), z.literal(15)]).optional(),
  requestId: z.string().uuid(),
  notes: z.string().max(200).default(""),
  occurrences: z.array(z.object({
    date: dateSchema,
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  })).min(2).max(MAX_RECURRING_VISITS).refine((values) => new Set(values.map((item) => item.date)).size === values.length),
}).refine(validCustomer, "Selecione um cliente cadastrado ou informe o nome.")
  .refine((data) => !data.useVipPlan || data.serviceIds.length === 0, "Escolha o item do plano ou serviços avulsos, não os dois juntos.")
  .refine((data) => !data.repeatForever || Boolean(data.intervalDays), "Escolha o intervalo da recorrência.")
  .refine((data) => {
    if (!data.repeatForever || !data.intervalDays) return true;
    const ordered = [...data.occurrences].sort((a, b) => a.date.localeCompare(b.date));
    return ordered.every((item, index) => item.time === ordered[0].time && item.date === addRecurringDays(ordered[0].date, index * data.intervalDays!));
  }, "Para repetir sempre, use o mesmo horário e intervalo em todas as visitas.");

export type RecurringBookingInput = z.infer<typeof recurringBookingSchema>;
export type RecurringPreviewDay = { date: string; slots: string[]; message?: string };
