import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createRecurringAppointments } from "../lib/appointmentMutations";
import { cancelRecurringSeries, cancelRecurringSeriesForCustomer, extendRecurringSeries, getRecurringSeriesForShop, mutateRecurringVisit } from "../lib/recurringSeries";
import { addRecurringDays } from "../lib/recurringBooking";
import { getCurrentScheduleDateValue } from "../lib/scheduleTime";
import { getVipCycle } from "../lib/vip";

const databaseUrl = process.env.DATABASE_URL || "";
const disposableIntegration = process.env.RECURRING_INTEGRATION_TEST === "1" && /localhost|127\.0\.0\.1/.test(databaseUrl);

async function fixture() {
  const db = new PrismaClient();
  const shopId = `recurring-test-${randomUUID()}`;
  await db.shop.create({ data: { id: shopId, name: "Recurring test", slug: shopId } });
  const barber = await db.user.create({ data: { shopId, name: "Barbeiro teste", role: "BARBER", isActive: true } });
  const customer = await db.user.create({ data: { shopId, name: "Cliente teste", role: "CUSTOMER", isActive: true } });
  const service = await db.service.create({ data: { shopId, name: "Corte teste", price: 40, duration: 30, isActive: true } });
  await db.barberAvailability.createMany({ data: Array.from({ length: 7 }, (_, weekDay) => ({ shopId, barberId: barber.id, weekDay, startTime: "08:00", endTime: "20:00", isActive: true })) });
  const firstDate = addRecurringDays(getCurrentScheduleDateValue(), 1);
  return {
    db,
    shopId,
    barber,
    customer,
    service,
    firstDate,
    async cleanup() {
      await db.shop.delete({ where: { id: shopId } });
      await db.$disconnect();
    },
  };
}

function input(f: Awaited<ReturnType<typeof fixture>>, overrides: Record<string, unknown> = {}) {
  return {
    shopId: f.shopId,
    adminId: "integration-admin",
    customerId: f.customer.id,
    barberId: f.barber.id,
    serviceIds: [f.service.id],
    requestId: randomUUID(),
    repeatForever: false,
    occurrences: [
      { date: f.firstDate, time: "09:00" },
      { date: addRecurringDays(f.firstDate, 15), time: "09:00" },
    ],
    notes: "",
    ...overrides,
  } as const;
}

test("cria série cadastrada, lista os dois lados e não duplica confirmação", { skip: !disposableIntegration }, async () => {
  const f = await fixture();
  try {
    const request = input(f);
    const first = await createRecurringAppointments(request, f.db);
    const replay = await createRecurringAppointments(request, f.db);
    assert.equal(first.ids.length, 2);
    assert.deepEqual(replay.ids, first.ids);
    assert.equal(await f.db.appointment.count({ where: { shopId: f.shopId, recurringBatchKey: first.batchKey } }), 2);
    const listed = await getRecurringSeriesForShop(f.shopId, f.db);
    assert.equal(listed[0]?.appointments.length, 2);
    assert.equal(await f.db.appointment.count({ where: { shopId: f.shopId, customerId: f.customer.id, isManualFitIn: false } }), 2);
    assert.equal((await f.db.appointment.findUniqueOrThrow({ where: { id: first.ids[0] } })).isManualFitIn, false);
  } finally { await f.cleanup(); }
});

test("cancela todas as séries ativas do cliente e preserva o histórico", { skip: !disposableIntegration }, async () => {
  const f = await fixture();
  try {
    const first = await createRecurringAppointments(input(f), f.db);
    const second = await createRecurringAppointments(input(f, {
      requestId: randomUUID(),
      occurrences: [
        { date: addRecurringDays(f.firstDate, 30), time: "11:00" },
        { date: addRecurringDays(f.firstDate, 45), time: "11:00" },
      ],
    }), f.db);
    await cancelRecurringSeriesForCustomer(f.shopId, f.customer.id, f.db);
    assert.equal(await f.db.appointment.count({ where: { shopId: f.shopId, recurringBatchKey: { in: [first.batchKey, second.batchKey] }, status: "CANCELLED" } }), 4);
  } finally { await f.cleanup(); }
});

test("cria cliente sem cadastro, cancela ocorrência isolada e depois toda a série", { skip: !disposableIntegration }, async () => {
  const f = await fixture();
  try {
    const request = input(f, { customerId: undefined, customerName: "Cliente avulso", serviceIds: [f.service.id] });
    const created = await createRecurringAppointments(request, f.db);
    assert.equal((await f.db.appointment.findUniqueOrThrow({ where: { id: created.ids[0] } })).isManualFitIn, true);
    await mutateRecurringVisit(f.shopId, created.ids[0], null, f.db);
    assert.equal((await f.db.appointment.findUniqueOrThrow({ where: { id: created.ids[0] } })).status, "CANCELLED");
    await cancelRecurringSeries(f.shopId, created.batchKey, f.db);
    assert.equal(await f.db.appointment.count({ where: { shopId: f.shopId, recurringBatchKey: created.batchKey, status: "CANCELLED" } }), 2);
  } finally { await f.cleanup(); }
});

test("série sempre cresce pelo cron sem duplicar e mantém conflito visível", { skip: !disposableIntegration }, async () => {
  const f = await fixture();
  try {
    const request = input(f, { repeatForever: true, intervalDays: 7, occurrences: [{ date: f.firstDate, time: "09:00" }, { date: addRecurringDays(f.firstDate, 7), time: "09:00" }] });
    const created = await createRecurringAppointments(request, f.db);
    const firstRun = await extendRecurringSeries(f.shopId, created.batchKey, {}, f.db);
    const secondRun = await extendRecurringSeries(f.shopId, created.batchKey, {}, f.db);
    assert.ok(firstRun.created > 0);
    assert.equal(secondRun.created, 0);
    await cancelRecurringSeries(f.shopId, created.batchKey, f.db);
    assert.equal((await f.db.recurringAppointmentSeries.findUniqueOrThrow({ where: { recurringBatchKey: created.batchKey } })).status, "CANCELLED");
  } finally { await f.cleanup(); }
});

test("item do plano usa duração do plano, não cobra serviço e respeita limite semanal", { skip: !disposableIntegration }, async () => {
  const f = await fixture();
  try {
    const plan = await f.db.vipPlan.create({ data: { shopId: f.shopId, code: "CORTE", name: "Bronze", price: 120, tokensPerCycle: 4, isActive: true } });
    const subscription = await f.db.vipSubscription.create({ data: { shopId: f.shopId, customerId: f.customer.id, planId: plan.id, status: "ACTIVE", tokensRemaining: 4, dueDay: 5, cycleStart: new Date("2026-11-01T00:00:00Z"), cycleEnd: new Date("2026-12-01T00:00:00Z") } });
    await f.db.vipPayment.create({ data: { shopId: f.shopId, subscriptionId: subscription.id, cycleMonth: getVipCycle().cycleMonth, amount: 120, status: "PAID", paidAt: new Date() } });
    const created = await createRecurringAppointments(input(f, { serviceIds: [], useVipPlan: true }), f.db);
    const appointments = await f.db.appointment.findMany({ where: { id: { in: created.ids } }, orderBy: { date: "asc" } });
    assert.equal(appointments.every((appointment) => appointment.isVipPlanUse), true);
    assert.equal(appointments.every((appointment) => appointment.services.length === 0), true);
    await assert.rejects(createRecurringAppointments(input(f, { serviceIds: [], useVipPlan: true, occurrences: [{ date: f.firstDate, time: "11:00" }, { date: addRecurringDays(f.firstDate, 1), time: "11:00" }] }), f.db), /nesta semana/);
  } finally { await f.cleanup(); }
});
