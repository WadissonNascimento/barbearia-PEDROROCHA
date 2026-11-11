import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { basePrisma } from "@/lib/prisma-core";
import {
  cancelAppointmentByCustomer,
  cancelRecurringAppointmentSeries,
  createCustomerAppointment,
  createRecurringAppointmentSeries,
} from "@/lib/appointmentMutations";
import { createScheduleDate, getScheduleDateValue } from "@/lib/scheduleTime";

test.after(async () => {
  await basePrisma.$disconnect();
});

function getNextBusinessDay(baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);

  do {
    date.setDate(date.getDate() + 1);
  } while (date.getDay() === 1);

  return date;
}

function getDateValue(date: Date) {
  return getScheduleDateValue(date);
}

function addDays(dateValue: string, days: number) {
  const date = createScheduleDate(dateValue, "10:00");
  assert.ok(date);
  date.setDate(date.getDate() + days);
  return getDateValue(date);
}

async function setupDatabase() {
  const db = new PrismaClient();
  const runId = `recurring-${Date.now()}-${Math.round(Math.random() * 100000)}`;

  return {
    db,
    runId,
    async cleanup() {
      await db.recurringAppointmentSeries.deleteMany({
        where: {
          customerName: {
            contains: runId,
          },
        },
      });
      await db.user.deleteMany({
        where: {
          email: {
            contains: `${runId}@test.local`,
          },
        },
      });
      await db.service.deleteMany({
        where: {
          name: {
            contains: runId,
          },
        },
      });
    },
  };
}

async function createFixture(db: PrismaClient, runId: string) {
  const barber = await db.user.create({
    data: {
      name: "Barbeiro Série",
      email: `barber-${runId}@test.local`,
      role: "BARBER",
      isActive: true,
    },
  });
  const customer = await db.user.create({
    data: {
      name: `Cliente ${runId}`,
      email: `customer-${runId}@test.local`,
      role: "CUSTOMER",
      isActive: true,
    },
  });

  await Promise.all(
    [0, 2, 3, 4, 5, 6].map((weekDay) =>
      db.barberAvailability.create({
        data: {
          barberId: barber.id,
          weekDay,
          startTime: "09:00",
          endTime: "20:00",
          isActive: true,
        },
      })
    )
  );

  const service = await db.service.create({
    data: {
      name: `Corte Série ${runId}`,
      price: 45,
      duration: 45,
      bufferAfter: 5,
      commissionType: "PERCENT",
      commissionValue: 40,
      isActive: true,
    },
  });

  return { barber, customer, service };
}

function buildInput(fixture: Awaited<ReturnType<typeof createFixture>>, startDate: string) {
  return {
    customerId: fixture.customer.id,
    seriesCustomerId: fixture.customer.id,
    customerName: `Cliente ${startDate}`,
    customerPhone: "11999999999",
    barberId: fixture.barber.id,
    serviceIds: [fixture.service.id],
    date: startDate,
    time: "10:00",
    frequency: "WEEKLY" as const,
    endDate: addDays(startDate, 14),
    unlimited: false,
    now: new Date(),
  };
}

test("recorrência semanal cria appointments reais ligados à série", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const fixture = await createFixture(db, runId);
    const startDate = getDateValue(getNextBusinessDay());
    const result = await createRecurringAppointmentSeries(
      buildInput(fixture, startDate),
      db
    );

    assert.equal(result.duplicate, false);
    assert.equal(result.failedOccurrences.length, 0);
    assert.equal(result.appointments.length, 3);
    assert.ok(result.appointments.every((appointment) => appointment.recurringSeriesId === result.series.id));
    assert.equal(result.appointments.every((appointment) => appointment.isManualFitIn), false);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("recorrência quinzenal respeita o intervalo de 14 dias", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const fixture = await createFixture(db, runId);
    const startDate = getDateValue(getNextBusinessDay());
    const result = await createRecurringAppointmentSeries(
      {
        ...buildInput(fixture, startDate),
        frequency: "BIWEEKLY" as const,
        endDate: addDays(startDate, 30),
      },
      db
    );

    assert.equal(result.appointments.length, 3);
    assert.deepEqual(
      result.appointments.map((appointment) => getDateValue(appointment.date)),
      [startDate, addDays(startDate, 14), addDays(startDate, 28)]
    );
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("série sem data final fica ilimitada e gera o horizonte inicial", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const fixture = await createFixture(db, runId);
    const startDate = getDateValue(getNextBusinessDay());
    const result = await createRecurringAppointmentSeries(
      {
        ...buildInput(fixture, startDate),
        endDate: null,
        unlimited: true,
      },
      db
    );

    assert.equal(result.series.unlimited, true);
    assert.equal(result.series.endDate, null);
    assert.ok(result.appointments.length >= 52);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("recorrência de cliente sem cadastro mantém o nome no fluxo manual", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const fixture = await createFixture(db, runId);
    const startDate = getDateValue(getNextBusinessDay());
    const result = await createRecurringAppointmentSeries(
      {
        ...buildInput(fixture, startDate),
        customerName: `Walk-in ${runId}`,
        seriesCustomerId: null,
        manualFitIn: true,
      },
      db
    );

    assert.equal(result.series.customerId, null);
    assert.equal(result.appointments[0]?.isManualFitIn, true);
    assert.match(result.appointments[0]?.notes || "", /Walk-in/);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("conflito em uma data não impede as próximas ocorrências", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const fixture = await createFixture(db, runId);
    const startDate = getDateValue(getNextBusinessDay());
    await createCustomerAppointment(
      {
        customerId: fixture.customer.id,
        barberId: fixture.barber.id,
        serviceIds: [fixture.service.id],
        date: startDate,
        time: "10:00",
      },
      db
    );

    const result = await createRecurringAppointmentSeries(
      buildInput(fixture, startDate),
      db
    );

    assert.equal(result.appointments.length, 2);
    assert.equal(result.failedOccurrences.length, 1);
    assert.equal(result.failedOccurrences[0]?.date, startDate);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("cliente cancela uma ocorrência sem cancelar a série", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const fixture = await createFixture(db, runId);
    const result = await createRecurringAppointmentSeries(
      buildInput(fixture, getDateValue(getNextBusinessDay())),
      db
    );
    const occurrence = result.appointments[0];
    assert.ok(occurrence);

    await cancelAppointmentByCustomer(
      {
        appointmentId: occurrence.id,
        customerId: fixture.customer.id,
      },
      db
    );

    const cancelled = await db.appointment.findUnique({
      where: { id: occurrence.id },
      select: { status: true, recurringSeriesId: true },
    });
    const series = await db.recurringAppointmentSeries.findUnique({
      where: { id: result.series.id },
      select: { status: true },
    });

    assert.equal(cancelled?.status, "CANCELLED");
    assert.equal(cancelled?.recurringSeriesId, result.series.id);
    assert.equal(series?.status, "ACTIVE");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("admin cancela todas as ocorrências futuras da série", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const fixture = await createFixture(db, runId);
    const result = await createRecurringAppointmentSeries(
      buildInput(fixture, getDateValue(getNextBusinessDay())),
      db
    );
    const cancelled = await cancelRecurringAppointmentSeries(
      {
        seriesId: result.series.id,
        shopId: fixture.barber.shopId,
      },
      db
    );

    assert.equal(cancelled.appointmentIds.length, result.appointments.length);
    const activeCount = await db.appointment.count({
      where: {
        recurringSeriesId: result.series.id,
        status: { not: "CANCELLED" },
      },
    });
    assert.equal(activeCount, 0);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("duas confirmações com a mesma chave não duplicam a série", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const fixture = await createFixture(db, runId);
    const startDate = getDateValue(getNextBusinessDay());
    const input = {
      ...buildInput(fixture, startDate),
      recurringBatchKey: `batch-${runId}`,
    };
    const first = await createRecurringAppointmentSeries(input, db);
    const second = await createRecurringAppointmentSeries(input, db);

    assert.equal(second.duplicate, true);
    assert.equal(second.series.id, first.series.id);
    assert.equal(second.appointments.length, first.appointments.length);
    assert.equal(
      await db.appointment.count({ recurringSeriesId: first.series.id }),
      first.appointments.length
    );
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});
