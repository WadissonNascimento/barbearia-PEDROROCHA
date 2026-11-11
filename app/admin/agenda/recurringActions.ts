"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getBookingAvailability, BookingAvailabilityError } from "@/lib/bookingAvailability";
import { AppointmentMutationError, createRecurringAppointments } from "@/lib/appointmentMutations";
import { notifyCustomerAppointmentConfirmed } from "@/lib/appointmentEmails";
import { notifyBarberNewAppointment } from "@/lib/barberEmails";
import { getVipPlanDurationMinutes, getActiveVipSubscriptionForCustomer } from "@/lib/vip";
import { getCurrentScheduleDateValue } from "@/lib/scheduleTime";
import { recurringBookingSchema, recurringDatesInRange, type RecurringPreviewDay, recurringPreviewSchema } from "@/lib/recurringBooking";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

async function validateContext(shopId: string, data: { customerId?: string; barberId: string; serviceIds: string[]; useVipPlan?: boolean }) {
  const [customer, barber, services, vipSubscription] = await Promise.all([
    data.customerId ? prisma.user.findFirst({ where: { id: data.customerId, shopId, role: "CUSTOMER", isActive: true }, select: { id: true } }) : true,
    prisma.user.findFirst({ where: { id: data.barberId, shopId, role: "BARBER", isActive: true }, select: { id: true } }),
    data.serviceIds.length
      ? prisma.service.count({ where: { shopId, id: { in: data.serviceIds }, isActive: true, OR: [{ barberId: null }, { barberId: data.barberId }] } })
      : 0,
    data.useVipPlan && data.customerId
      ? getActiveVipSubscriptionForCustomer(prisma, { shopId, customerId: data.customerId })
      : null,
  ]);
  return {
    valid: Boolean(customer && barber && services === data.serviceIds.length && (!data.useVipPlan || vipSubscription)),
    vipSubscription,
  };
}

export async function previewRecurringAppointmentsAction(input: unknown): Promise<Result<RecurringPreviewDay[]>> {
  const { user, shopId } = await requireTenantSession({ roles: SHOP_ADMIN_ROLES });
  const parsed = recurringPreviewSchema.safeParse(input);
  if (!parsed.success || !recurringDatesInRange(parsed.data.dates, getCurrentScheduleDateValue())) {
    return { ok: false, message: "Escolha cliente, barbeiro, serviços e de 2 a 12 datas nos próximos 180 dias." };
  }
  const limit = await enforceRateLimit({ scope: "admin:recurring_preview", identifier: user.id, limit: 60, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return { ok: false, message: "Aguarde um pouco antes de consultar novamente." };

  const data = parsed.data;
  const context = await validateContext(shopId, data);
  if (!context.valid) return { ok: false, message: "Cliente, barbeiro, serviços ou plano indisponíveis nesta barbearia." };
  const additionalDurationMinutes = context.vipSubscription ? getVipPlanDurationMinutes(context.vipSubscription.plan.code) : 0;
  const days: RecurringPreviewDay[] = [];

  for (const date of [...data.dates].sort()) {
    try {
      const availability = await getBookingAvailability({ barberId: data.barberId, serviceIds: data.serviceIds, date, additionalDurationMinutes });
      const slots = Object.values(availability.periodSlots).flat();
      days.push({ date, slots, ...(slots.length ? {} : { message: "Sem horários disponíveis neste dia." }) });
    } catch (error) {
      if (error instanceof BookingAvailabilityError) days.push({ date, slots: [], message: error.message });
      else throw error;
    }
  }
  return { ok: true, data: days };
}

export async function createRecurringAppointmentsAction(input: unknown): Promise<Result<{ count: number }>> {
  const { user, shopId } = await requireTenantSession({ roles: SHOP_ADMIN_ROLES });
  const parsed = recurringBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Confira os dados e horários da sequência." };
  const limit = await enforceRateLimit({ scope: "admin:recurring_create", identifier: user.id, limit: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return { ok: false, message: "Muitas confirmações. Aguarde antes de tentar novamente." };
  const context = await validateContext(shopId, parsed.data);
  if (!context.valid) return { ok: false, message: "Cliente, barbeiro, serviços ou plano indisponíveis nesta barbearia." };

  try {
    const result = await createRecurringAppointments({ ...parsed.data, shopId, adminId: user.id });
    for (const path of ["/admin", "/admin/agenda", "/admin/recorrentes", "/barber", "/barber/agenda", "/customer", "/customer/agendamentos", "/meu-perfil", "/agendar"]) revalidatePath(path);
    if (result.created) {
      after(async () => {
        await Promise.allSettled(result.ids.flatMap((appointmentId) => [notifyCustomerAppointmentConfirmed(appointmentId), notifyBarberNewAppointment(appointmentId)]));
      });
    }
    logSecurityEvent("admin_recurring_appointments_created", { adminId: user.id, shopId, count: result.ids.length });
    return { ok: true, data: { count: result.ids.length } };
  } catch (error) {
    if (error instanceof AppointmentMutationError) return { ok: false, message: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, message: "Essa sequência já foi confirmada. Atualize a agenda para conferir os horários." };
    throw error;
  }
}
