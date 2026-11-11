import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  addRecurringDays,
  generateRecurringDates,
  recurringBookingSchema,
  recurringDatesInRange,
} from "../lib/recurringBooking";

test("gera recorrências semanais, quinzenais e de 15 dias sem deslocar a data", () => {
  assert.deepEqual(generateRecurringDates("2026-11-12", 7, 3), ["2026-11-12", "2026-11-19", "2026-11-26"]);
  assert.deepEqual(generateRecurringDates("2026-11-12", 14, 3), ["2026-11-12", "2026-11-26", "2026-12-10"]);
  assert.deepEqual(generateRecurringDates("2026-11-12", 15, 3), ["2026-11-12", "2026-11-27", "2026-12-12"]);
  assert.equal(addRecurringDays("2026-02-28", 1), "2026-03-01");
});

test("valida cliente cadastrado, cliente sem cadastro e item do plano", () => {
  const base = {
    barberId: "barber",
    requestId: randomUUID(),
    repeatForever: true,
    intervalDays: 7 as const,
    occurrences: [
      { date: "2026-11-12", time: "09:00" },
      { date: "2026-11-19", time: "09:00" },
    ],
  };
  assert.equal(recurringBookingSchema.safeParse({ ...base, customerId: "customer", serviceIds: [] }).success, true);
  assert.equal(recurringBookingSchema.safeParse({ ...base, customerName: "João", serviceIds: ["service"] }).success, true);
  assert.equal(recurringBookingSchema.safeParse({ ...base, customerId: "customer", serviceIds: ["service"], useVipPlan: true }).success, false);
  assert.equal(recurringBookingSchema.safeParse({ ...base, customerName: "J", serviceIds: [] }).success, false);
});

test("exige intervalo e mesmo horário para a série sem data final", () => {
  const base = {
    customerName: "João da Silva",
    barberId: "barber",
    serviceIds: ["service"],
    requestId: randomUUID(),
    repeatForever: true,
    intervalDays: 7 as const,
    occurrences: [
      { date: "2026-11-12", time: "09:00" },
      { date: "2026-11-19", time: "10:00" },
    ],
  };
  assert.equal(recurringBookingSchema.safeParse(base).success, false);
  assert.equal(recurringBookingSchema.safeParse({ ...base, intervalDays: undefined, occurrences: [{ date: "2026-11-12", time: "09:00" }, { date: "2026-11-19", time: "09:00" }] }).success, false);
});

test("limita as datas ao horizonte de criação", () => {
  assert.equal(recurringDatesInRange(["2026-11-12", "2027-01-01"], "2026-11-11"), true);
  assert.equal(recurringDatesInRange(["2026-11-12", "2027-06-01"], "2026-11-11"), false);
});
