"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AppointmentMutationError } from "@/lib/appointmentMutations";
import { cancelRecurringSeries, cancelRecurringSeriesForCustomer, extendRecurringSeries, getRecurringHistory, mutateRecurringVisit } from "@/lib/recurringSeries";
import { isValidRecurringDate } from "@/lib/recurringBooking";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

const id = z.string().trim().min(1).max(300);
const batchSchema = z.object({ batchKey: id });
const customerSchema = z.object({ customerId: id });
const visitSchema = z.object({ appointmentId: id });
const moveSchema = visitSchema.extend({ date: z.string().refine(isValidRecurringDate), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) });

async function execute(event: string, input: unknown, schema: z.ZodTypeAny, change: (shopId: string, data: any) => Promise<unknown>) {
  const { user, shopId } = await requireTenantSession({ roles: SHOP_ADMIN_ROLES });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Confira os dados da recorrência." };
  const limit = await enforceRateLimit({ scope: "admin:recurring_manage", identifier: user.id, limit: 100, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return { ok: false as const, message: "Muitas alterações. Aguarde um pouco e tente novamente." };
  try {
    const data = await change(shopId, parsed.data);
    for (const path of ["/admin/recorrentes", "/admin", "/admin/agenda", "/barber", "/barber/agenda", "/customer/agendamentos", "/meu-perfil", "/agendar"]) revalidatePath(path);
    logSecurityEvent(event, { adminId: user.id, shopId });
    return { ok: true as const, data };
  } catch (error) {
    if (error instanceof AppointmentMutationError) return { ok: false as const, message: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2028"].includes(error.code)) return { ok: false as const, message: "A agenda mudou durante a alteração. Atualize e tente novamente." };
    throw error;
  }
}

export async function cancelRecurringSeriesAction(input: unknown) { return execute("admin_recurring_series_cancelled", input, batchSchema, (shopId, data) => cancelRecurringSeries(shopId, data.batchKey)); }
export async function cancelCustomerRecurringSeriesAction(input: unknown) { return execute("admin_customer_recurring_series_cancelled", input, customerSchema, (shopId, data) => cancelRecurringSeriesForCustomer(shopId, data.customerId)); }
export async function cancelRecurringVisitAction(input: unknown) { return execute("admin_recurring_visit_cancelled", input, visitSchema, (shopId, data) => mutateRecurringVisit(shopId, data.appointmentId, null)); }
export async function rescheduleRecurringVisitAction(input: unknown) { return execute("admin_recurring_visit_rescheduled", input, moveSchema, (shopId, data) => mutateRecurringVisit(shopId, data.appointmentId, { date: data.date, time: data.time })); }
export async function retryRecurringSeriesAction(input: unknown) { return execute("admin_recurring_series_retried", input, batchSchema, (shopId, data) => extendRecurringSeries(shopId, data.batchKey, { retryConflicts: true })); }

export async function loadRecurringHistoryAction(input: unknown) {
  const { shopId } = await requireTenantSession({ roles: SHOP_ADMIN_ROLES });
  const parsed = batchSchema.extend({ before: z.string().datetime() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Histórico inválido." };
  return { ok: true as const, data: await getRecurringHistory(shopId, parsed.data.batchKey, new Date(parsed.data.before)) };
}
