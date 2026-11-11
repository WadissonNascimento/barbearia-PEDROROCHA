import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AppointmentMutationError,
  createCustomerAppointmentInTransaction,
  rescheduleCustomerAppointmentInTransaction,
  updateAppointmentStatusWithSideEffects,
} from "@/lib/appointmentMutations";
import { addRecurringDays, isValidRecurringDate } from "@/lib/recurringBooking";
import {
  formatManualFitInNotes,
  getManualFitInCustomerDisplay,
  getManualFitInVisibleNotes,
} from "@/lib/manualFitIn";
import { isActiveAppointmentStatus } from "@/lib/barberSchedule";
import {
  createScheduleDate,
  formatScheduleTime,
  getCurrentScheduleDate,
  getCurrentScheduleDateValue,
  getScheduleDateValue,
} from "@/lib/scheduleTime";
import type { RecurringConflict, RecurringSeriesSummary, RecurringVisit } from "@/lib/recurringSeriesTypes";

export const RECURRING_HORIZON_DAYS = 90;
const HISTORY_PAGE_SIZE = 20;
const txOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10000,
  timeout: 60000,
};
const visitInclude = {
  customer: { select: { name: true } },
  barber: { select: { name: true } },
  services: { orderBy: { orderIndex: "asc" as const } },
};
type VisitRow = Prisma.AppointmentGetPayload<{ include: typeof visitInclude }>;

function serializeVisit(row: VisitRow, now: Date): RecurringVisit {
  return {
    id: row.id,
    date: row.date.toISOString(),
    dateValue: getScheduleDateValue(row.date),
    time: formatScheduleTime(row.date),
    status: row.status,
    serviceNames: row.services.map((item) => item.nameSnapshot),
    barberName: row.barber.name || "Barbeiro",
    canEdit: row.date >= now && isActiveAppointmentStatus(row.status),
  };
}

export function readRecurringConflicts(value: Prisma.JsonValue): RecurringConflict[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    return typeof item.date === "string" && typeof item.time === "string" && typeof item.message === "string"
      ? [{ date: item.date, time: item.time, message: item.message }]
      : [];
  });
}

async function lockSeries(tx: Prisma.TransactionClient, shopId: string, batchKey: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${shopId}), hashtext(${batchKey}))`;
}

export async function getRecurringHistory(shopId: string, batchKey: string, before: Date, db: PrismaClient = prisma) {
  const rows = await db.appointment.findMany({
    where: { shopId, recurringBatchKey: batchKey, date: { lt: before } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: HISTORY_PAGE_SIZE + 1,
    include: visitInclude,
  });
  const selected = rows.slice(0, HISTORY_PAGE_SIZE);
  return {
    appointments: selected.map((row) => serializeVisit(row, getCurrentScheduleDate())).reverse(),
    hasMoreHistory: rows.length > HISTORY_PAGE_SIZE,
    historyCursor: selected.at(-1)?.date.toISOString() || null,
  };
}

export async function getRecurringSeriesForShop(shopId: string, db: PrismaClient = prisma): Promise<RecurringSeriesSummary[]> {
  const now = getCurrentScheduleDate();
  const [rules, futureRows, pastIds] = await Promise.all([
    db.recurringAppointmentSeries.findMany({ where: { shopId }, orderBy: { createdAt: "desc" } }),
    db.appointment.findMany({
      where: { shopId, recurringBatchKey: { not: null }, date: { gte: now } },
      orderBy: { date: "asc" },
      include: visitInclude,
    }),
    db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "recurringBatchKey" ORDER BY date DESC, id DESC) AS position
        FROM "Appointment"
        WHERE "shopId" = ${shopId} AND "recurringBatchKey" IS NOT NULL AND date < ${now}
      ) history WHERE position <= ${HISTORY_PAGE_SIZE + 1}
    `),
  ]);
  const pastRows = pastIds.length
    ? await db.appointment.findMany({ where: { shopId, id: { in: pastIds.map((row) => row.id) } }, orderBy: [{ date: "desc" }, { id: "desc" }], include: visitInclude })
    : [];

  const keys = new Set([
    ...rules.map((rule) => rule.recurringBatchKey).filter((key): key is string => Boolean(key)),
    ...futureRows.map((row) => row.recurringBatchKey).filter((key): key is string => Boolean(key)),
    ...pastRows.map((row) => row.recurringBatchKey).filter((key): key is string => Boolean(key)),
  ]);
  const result: RecurringSeriesSummary[] = [];

  for (const batchKey of keys) {
    const rule = rules.find((item) => item.recurringBatchKey === batchKey);
    const future = futureRows.filter((item) => item.recurringBatchKey === batchKey);
    const past = pastRows.filter((item) => item.recurringBatchKey === batchKey);
    const historyPage = past.slice(0, HISTORY_PAGE_SIZE);
    const representative = future[0] || past[0];
    if (!representative && !rule) continue;

    const ruleConflicts = rule ? readRecurringConflicts(rule.conflicts) : [];
    const futureCount = future.filter((item) => isActiveAppointmentStatus(item.status)).length;
    const repeatForever = Boolean(rule?.repeatForever || rule?.unlimited);
    const activeForever = repeatForever && rule?.status === "ACTIVE";
    const serviceNames = representative?.services.map((item) => item.nameSnapshot) || (rule?.vipPlanName ? [rule.vipPlanName] : []);
    const nextActive = future.find((item) => isActiveAppointmentStatus(item.status));

    result.push({
      batchKey,
      seriesId: rule?.id || null,
      customerName: representative?.isManualFitIn
        ? getManualFitInCustomerDisplay({ notes: representative.notes }).name
        : representative?.customer.name || rule?.customerName || "Cliente",
      customerId: representative?.isManualFitIn ? null : representative?.customerId || rule?.customerId || null,
      barberName: representative?.barber.name || "Barbeiro",
      serviceNames,
      repeatForever,
      intervalDays: rule?.intervalDays || null,
      useVipPlan: Boolean(rule?.useVipPlan),
      vipPlanName: rule?.vipPlanName || null,
      status: rule?.status === "CANCELLED" ? "CANCELLED" : activeForever || futureCount > 0 ? "ACTIVE" : "FINISHED",
      nextDate: nextActive ? getScheduleDateValue(nextActive.date) : rule?.nextDate ? getScheduleDateValue(rule.nextDate) : null,
      time: rule?.time || (nextActive ? formatScheduleTime(nextActive.date) : null),
      conflicts: ruleConflicts,
      appointments: [
        ...historyPage.map((row) => serializeVisit(row, now)).reverse(),
        ...future.map((row) => serializeVisit(row, now)),
      ],
      futureCount,
      hasMoreHistory: past.length > HISTORY_PAGE_SIZE,
      historyCursor: historyPage.at(-1)?.date.toISOString() || null,
    });
  }

  return result.sort((left, right) => (left.status === "ACTIVE" ? 0 : 1) - (right.status === "ACTIVE" ? 0 : 1) || left.customerName.localeCompare(right.customerName, "pt-BR"));
}

export async function cancelRecurringSeries(shopId: string, batchKey: string, db: PrismaClient = prisma, now = new Date()) {
  return db.$transaction(async (tx) => {
    await lockSeries(tx, shopId, batchKey);
    const rule = await tx.recurringAppointmentSeries.findUnique({ where: { recurringBatchKey: batchKey } });
    if (rule && rule.shopId !== shopId) throw new AppointmentMutationError("Recorrência não encontrada nesta barbearia.");
    const visits = await tx.appointment.findMany({ where: { shopId, recurringBatchKey: batchKey }, orderBy: { date: "asc" }, include: visitInclude });
    if (!rule && !visits.length) throw new AppointmentMutationError("Recorrência não encontrada nesta barbearia.");

    if (rule) {
      await tx.recurringAppointmentSeries.update({
        where: { id: rule.id },
        data: { status: "CANCELLED", cancelledAt: now, nextDate: null, conflicts: [] },
      });
    } else {
      const first = visits[0];
      await tx.recurringAppointmentSeries.create({
        data: {
          shopId,
          recurringBatchKey: batchKey,
          customerId: first.isManualFitIn ? null : first.customerId,
          customerName: first.isManualFitIn ? getManualFitInCustomerDisplay({ notes: first.notes }).name : first.customer.name || "Cliente",
          barberId: first.barberId,
          serviceIds: first.services.map((item) => item.serviceId),
          time: formatScheduleTime(first.date),
          frequency: "LEGACY",
          startDate: first.date,
          unlimited: false,
          repeatForever: false,
          status: "CANCELLED",
          cancelledAt: now,
        },
      });
    }

    const cancellable = visits.filter((item) => item.date >= getCurrentScheduleDate(now) && isActiveAppointmentStatus(item.status));
    for (const visit of cancellable) {
      await updateAppointmentStatusWithSideEffects({ appointmentId: visit.id, nextStatus: "CANCELLED", cancellationReason: "Recorrência cancelada pelo administrador." }, tx);
    }
    return { count: cancellable.length };
  }, txOptions);
}

export async function cancelRecurringSeriesForCustomer(
  shopId: string,
  customerId: string,
  db: PrismaClient = prisma,
  now = new Date()
) {
  const [series, appointments] = await Promise.all([
    db.recurringAppointmentSeries.findMany({
      where: { shopId, customerId, status: "ACTIVE", recurringBatchKey: { not: null } },
      select: { recurringBatchKey: true },
    }),
    db.appointment.findMany({
      where: { shopId, customerId, recurringBatchKey: { not: null } },
      distinct: ["recurringBatchKey"],
      select: { recurringBatchKey: true },
    }),
  ]);
  const batchKeys = new Set(
    [...series, ...appointments]
      .map((item) => item.recurringBatchKey)
      .filter((batchKey): batchKey is string => Boolean(batchKey))
  );
  if (!batchKeys.size) {
    throw new AppointmentMutationError("Nenhuma recorrência ativa foi encontrada para este cliente.");
  }

  let cancelledVisits = 0;
  for (const batchKey of batchKeys) {
    const result = await cancelRecurringSeries(shopId, batchKey, db, now);
    cancelledVisits += result.count;
  }
  return { seriesCount: batchKeys.size, cancelledVisits };
}

export async function mutateRecurringVisit(shopId: string, appointmentId: string, change: { date: string; time: string } | null, db: PrismaClient = prisma) {
  if (change && !isValidRecurringDate(change.date)) throw new AppointmentMutationError("Data inválida para a visita.");
  return db.$transaction(async (tx) => {
    const found = await tx.appointment.findFirst({ where: { id: appointmentId, shopId, recurringBatchKey: { not: null } }, select: { recurringBatchKey: true } });
    if (!found?.recurringBatchKey) throw new AppointmentMutationError("Agendamento recorrente não encontrado.");
    await lockSeries(tx, shopId, found.recurringBatchKey);
    const visit = await tx.appointment.findFirst({ where: { id: appointmentId, shopId }, include: { services: { orderBy: { orderIndex: "asc" } }, items: true } });
    if (!visit || visit.date < getCurrentScheduleDate() || !isActiveAppointmentStatus(visit.status)) throw new AppointmentMutationError("Este atendimento já passou ou foi finalizado.");

    if (!change) {
      await updateAppointmentStatusWithSideEffects({ appointmentId, nextStatus: "CANCELLED", cancellationReason: "Visita da recorrência cancelada pelo administrador." }, tx);
    } else {
      await rescheduleCustomerAppointmentInTransaction({
        appointmentId,
        customerId: visit.customerId,
        barberId: visit.barberId,
        serviceIds: visit.services.map((item) => item.serviceId),
        extras: visit.items.map((item) => ({ extraProductId: item.extraProductId, quantity: item.quantity })),
        date: change.date,
        time: change.time,
        notes: visit.isManualFitIn ? getManualFitInVisibleNotes(visit.notes) : visit.notes,
        useVipPlan: visit.isVipPlanUse,
      }, tx, { actor: "ADMIN" });
    }
    return { appointmentId };
  }, txOptions);
}

export async function extendRecurringSeries(shopId: string, batchKey: string, options: { retryConflicts?: boolean; now?: Date } = {}, db: PrismaClient = prisma) {
  const now = options.now || new Date();
  const today = getCurrentScheduleDateValue(now);
  const horizon = addRecurringDays(today, RECURRING_HORIZON_DAYS);
  let created = 0;
  let conflicts = 0;
  const createdIds: string[] = [];
  const retriedDates = new Set<string>();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await db.$transaction(async (tx) => {
      await lockSeries(tx, shopId, batchKey);
      const rule = await tx.recurringAppointmentSeries.findUnique({ where: { recurringBatchKey: batchKey } });
      if (!rule || rule.shopId !== shopId || rule.status !== "ACTIVE" || !rule.repeatForever || !rule.intervalDays || !rule.nextDate) return null;

      let issues = readRecurringConflicts(rule.conflicts).filter((item) => item.date >= today);
      const retry = options.retryConflicts ? issues.find((item) => !retriedDates.has(item.date)) : undefined;
      const date = retry?.date || getScheduleDateValue(rule.nextDate);
      if (date > horizon) return null;
      if (retry) retriedDates.add(date);
      const occurrenceDate = createScheduleDate(date, rule.time);
      if (!occurrenceDate) return null;

      let made = 0;
      let failed = false;
      if (occurrenceDate <= getCurrentScheduleDate(now)) {
        failed = true;
        issues.push({ date, time: rule.time, message: "O horário já passou sem ser reservado." });
      } else {
        try {
          const alreadyExists = await tx.appointment.findFirst({ where: { shopId, recurringBatchKey: batchKey, recurringOccurrenceDate: occurrenceDate }, select: { id: true } });
          if (!alreadyExists) {
            const representative = await tx.appointment.findFirst({ where: { shopId, recurringBatchKey: batchKey }, orderBy: { date: "asc" }, select: { customerId: true } });
            const customerId = rule.customerId || representative?.customerId;
            if (!customerId) throw new AppointmentMutationError("Não foi possível localizar o cliente da recorrência.");
            const appointment = await createCustomerAppointmentInTransaction({
              customerId,
              barberId: rule.barberId,
              serviceIds: rule.serviceIds,
              date,
              time: rule.time,
              notes: rule.customerId ? rule.notes : formatManualFitInNotes({ customerName: rule.customerName, customerPhone: rule.customerPhone, notes: rule.notes }),
              useVipPlan: rule.useVipPlan,
              now,
              recurringSeriesId: rule.id,
              recurringBatchKey: batchKey,
              recurringOccurrenceDate: occurrenceDate,
            }, tx, { manualFitIn: !rule.customerId, validateAvailability: true });
            createdIds.push(appointment.id);
            made = 1;
          }
          issues = issues.filter((item) => item.date !== date);
        } catch (error) {
          if (!(error instanceof AppointmentMutationError)) throw error;
          failed = true;
          issues = issues.filter((item) => item.date !== date);
          issues.push({ date, time: rule.time, message: error.message.replace(/ Nenhum agendamento da sequência foi criado\.$/, "") });
        }
      }

      const nextDate = retry ? rule.nextDate : createScheduleDate(addRecurringDays(date, rule.intervalDays), rule.time);
      await tx.recurringAppointmentSeries.update({ where: { id: rule.id }, data: { nextDate, conflicts: issues } });
      return { made, failed };
    }, txOptions);
    if (!result) break;
    created += result.made;
    if (result.failed) conflicts += 1;
  }
  return { created, conflicts, ids: createdIds };
}

export async function extendRecurringAppointmentsForShop(shopId: string, db: PrismaClient = prisma) {
  const rules = await db.recurringAppointmentSeries.findMany({ where: { shopId, status: "ACTIVE", repeatForever: true }, select: { recurringBatchKey: true } });
  let created = 0;
  let conflicts = 0;
  let failed = 0;
  const ids: string[] = [];
  for (const rule of rules) {
    if (!rule.recurringBatchKey) continue;
    try {
      const result = await extendRecurringSeries(shopId, rule.recurringBatchKey, {}, db);
      created += result.created;
      conflicts += result.conflicts;
      ids.push(...result.ids);
    } catch (error) {
      failed += 1;
      console.error("Recurring generation failed", { shopId, batchKey: rule.recurringBatchKey, error: error instanceof Error ? error.name : "UnknownError" });
    }
  }
  return { checked: rules.length, created, conflicts, failed, ids };
}
