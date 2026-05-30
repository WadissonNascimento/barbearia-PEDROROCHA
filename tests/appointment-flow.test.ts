import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { basePrisma } from "@/lib/prisma-core";
import {
  AppointmentMutationError,
  cancelAppointmentByCustomer,
  createCustomerAppointment,
  createManualFitInAppointment,
  editOpenAppointmentForBarber,
  rescheduleCustomerAppointment,
  updateAppointmentStatusForAdmin,
  updateAppointmentStatusForBarber,
} from "@/lib/appointmentMutations";
import { getAppointmentTotalBarberPayout } from "@/lib/appointmentServices";
import { getBookingAvailability } from "@/lib/bookingAvailability";
import { toMoneyNumber } from "@/lib/money";
import { createScheduleDate } from "@/lib/scheduleTime";

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

async function setupDatabase() {
  const db = new PrismaClient();
  const runId = `${Date.now()}-${Math.round(Math.random() * 100000)}`;

  return {
    db,
    runId,
    async cleanup() {
      await db.stockMovement.deleteMany({
        where: {
          product: {
            name: {
              contains: runId,
            },
          },
        },
      });
      await db.extraStockMovement.deleteMany({
        where: {
          extraProduct: {
            name: {
              contains: runId,
            },
          },
        },
      });
      await db.product.deleteMany({
        where: {
          name: {
            contains: runId,
          },
        },
      });
      await db.extraProduct.deleteMany({
        where: {
          name: {
            contains: runId,
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
      await db.user.deleteMany({
        where: {
          email: {
            contains: `${runId}@test.local`,
          },
        },
      });
    },
  };
}

async function createFixture(db: PrismaClient, suffix: string) {
  const barber = await db.user.create({
    data: {
      name: "Lucas Teste",
      email: `lucas-${suffix}@test.local`,
      role: "BARBER",
      isActive: true,
    },
  });

  const customer = await db.user.create({
    data: {
      name: "Cliente Teste",
      email: `cliente-${suffix}@test.local`,
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

  const corte = await db.service.create({
    data: {
      name: `Corte Teste ${suffix}`,
      price: 45,
      duration: 45,
      bufferAfter: 5,
      commissionType: "PERCENT",
      commissionValue: 40,
      isActive: true,
    },
  });

  const barba = await db.service.create({
    data: {
      name: `Barba Teste ${suffix}`,
      price: 30,
      duration: 30,
      bufferAfter: 5,
      commissionType: "PERCENT",
      commissionValue: 40,
      isActive: true,
    },
  });

  const pomada = await db.extraProduct.create({
    data: {
      name: `Pomada Teste ${suffix}`,
      category: "SHELF",
      price: 25,
      stock: 4,
      isActive: true,
    },
  });

  const bebida = await db.extraProduct.create({
    data: {
      name: `Bebida Teste ${suffix}`,
      category: "BEVERAGE",
      price: 8,
      stock: 6,
      isActive: true,
    },
  });

  return { barber, customer, corte, barba, pomada, bebida };
}

test("customer can book and conclude an appointment", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte, barba } = await createFixture(db, runId);
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    const appointment = await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id, barba.id],
        date,
        time: "10:00",
        notes: "Cliente prefere acabamento baixo.",
      },
      db
    );

    assert.equal(appointment.customerId, customer.id);
    assert.equal(appointment.barberId, barber.id);
    assert.equal(appointment.status, "CONFIRMED");
    assert.equal(appointment.services.length, 2);
    assert.equal(appointment.services[0].nameSnapshot, `Corte Teste ${runId}`);
    assert.equal(appointment.services[1].nameSnapshot, `Barba Teste ${runId}`);

    await updateAppointmentStatusForBarber(
      {
        appointmentId: appointment.id,
        barberId: barber.id,
        status: "CONFIRMED",
      },
      db
    );

    await updateAppointmentStatusForBarber(
      {
        appointmentId: appointment.id,
        barberId: barber.id,
        status: "COMPLETED",
        paymentMethod: "PIX",
      },
      db
    );

    const updated = await db.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        services: true,
      },
    });

    assert.ok(updated);
    assert.equal(updated.status, "COMPLETED");
    assert.equal(updated.services.every((service) => toMoneyNumber(service.barberPayoutSnapshot) > 0), true);
    assert.equal(updated.services.every((service) => toMoneyNumber(service.shopRevenueSnapshot) >= 0), true);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("manual fit-in bypasses availability without changing financial snapshots", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte } = await createFixture(db, runId);
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    await assert.rejects(
      () =>
        createCustomerAppointment(
          {
            customerId: customer.id,
            barberId: barber.id,
            serviceIds: [corte.id],
            date,
            time: "08:00",
          },
          db
        ),
      (error: unknown) =>
        error instanceof AppointmentMutationError &&
        error.message === "O horario escolhido esta fora da disponibilidade do barbeiro."
    );

    const appointment = await createManualFitInAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        date,
        time: "08:00",
        notes: "Encaixe Manual",
        conflictMode: "SAME_START_ONLY",
      },
      db
    );

    assert.equal(appointment.isManualFitIn, true);
    assert.equal(appointment.status, "CONFIRMED");
    assert.equal(toMoneyNumber(appointment.services[0].barberPayoutSnapshot) > 0, true);

    await assert.rejects(
      () =>
        createManualFitInAppointment(
          {
            customerId: customer.id,
            barberId: barber.id,
            serviceIds: [corte.id],
            date,
            time: "08:00",
            conflictMode: "SAME_START_ONLY",
          },
          db
        ),
      (error: unknown) =>
        error instanceof AppointmentMutationError &&
        error.message === "Esse horario acabou de ser reservado. Escolha outro horario."
    );
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("customer cannot create overlapping appointment for the same barber", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte } = await createFixture(db, runId);
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        date,
        time: "14:00",
      },
      db
    );

    await assert.rejects(
      () =>
        createCustomerAppointment(
          {
            customerId: customer.id,
            barberId: barber.id,
            serviceIds: [corte.id],
            date,
            time: "14:20",
          },
          db
        ),
      (error: unknown) =>
        error instanceof AppointmentMutationError &&
        error.message === "Esse horario acabou de ser reservado. Escolha outro horario."
    );
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("customer cannot create concurrent appointment for the same barber and time", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte } = await createFixture(db, runId);
    const secondCustomer = await db.user.create({
      data: {
        name: "Segundo Cliente Teste",
        email: `segundo-cliente-${runId}@test.local`,
        role: "CUSTOMER",
        isActive: true,
      },
    });
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    const results = await Promise.allSettled([
      createCustomerAppointment(
        {
          customerId: customer.id,
          barberId: barber.id,
          serviceIds: [corte.id],
          date,
          time: "16:00",
        },
        db
      ),
      createCustomerAppointment(
        {
          customerId: secondCustomer.id,
          barberId: barber.id,
          serviceIds: [corte.id],
          date,
          time: "16:00",
        },
        db
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(
      rejected[0].reason instanceof AppointmentMutationError &&
        rejected[0].reason.message ===
          "Esse horario acabou de ser reservado. Escolha outro horario.",
      true
    );

    const appointmentCount = await db.appointment.count({
      where: {
        barberId: barber.id,
        date: createScheduleDate(date, "16:00")!,
        status: {
          in: ["PENDING", "CONFIRMED"],
        },
      },
    });

    assert.equal(appointmentCount, 1);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("barber can edit an open appointment without revalidating an unchanged slot", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte, pomada } = await createFixture(db, runId);
    const secondCustomer = await db.user.create({
      data: {
        name: "Cliente Seguinte Teste",
        email: `cliente-seguinte-${runId}@test.local`,
        role: "CUSTOMER",
        isActive: true,
      },
    });
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    const appointment = await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        date,
        time: "10:00",
      },
      db
    );

    await createCustomerAppointment(
      {
        customerId: secondCustomer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        date,
        time: "10:50",
      },
      db
    );

    await db.barberAvailability.deleteMany({
      where: {
        barberId: barber.id,
        weekDay: nextDay.getDay(),
      },
    });

    const edited = await editOpenAppointmentForBarber(
      {
        appointmentId: appointment.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        extras: [{ extraProductId: pomada.id, quantity: 1 }],
        notes: "Apenas ajustou o atendimento existente.",
      },
      db
    );

    assert.equal(edited.appointment.id, appointment.id);
    assert.equal(edited.appointment.date.getTime(), appointment.date.getTime());
    assert.equal(edited.appointment.items.length, 1);
    assert.equal(edited.appointment.notes, "Apenas ajustou o atendimento existente.");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("barber can record a longer performed service without moving the appointment slot", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte } = await createFixture(db, runId);
    const secondCustomer = await db.user.create({
      data: {
        name: "Cliente Conflito Teste",
        email: `cliente-conflito-${runId}@test.local`,
        role: "CUSTOMER",
        isActive: true,
      },
    });
    const longService = await db.service.create({
      data: {
        name: `Servico Longo Teste ${runId}`,
        price: 80,
        duration: 70,
        bufferAfter: 0,
        commissionType: "PERCENT",
        commissionValue: 40,
        isActive: true,
      },
    });
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    const appointment = await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        date,
        time: "10:00",
      },
      db
    );

    await createCustomerAppointment(
      {
        customerId: secondCustomer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        date,
        time: "10:50",
      },
      db
    );

    const edited = await editOpenAppointmentForBarber(
      {
        appointmentId: appointment.id,
        barberId: barber.id,
        serviceIds: [longService.id],
        notes: "Registrou o servico executado.",
      },
      db
    );

    assert.equal(edited.appointment.id, appointment.id);
    assert.equal(edited.appointment.date.getTime(), appointment.date.getTime());
    assert.equal(edited.appointment.services[0].serviceId, longService.id);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("booking availability respects recurring blocks and ignores cancelled appointments", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte } = await createFixture(db, runId);
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    await db.recurringBarberBlock.create({
      data: {
        barberId: barber.id,
        weekDay: nextDay.getDay(),
        startTime: "13:00",
        endTime: "14:00",
        reason: "Almoco",
        isActive: true,
      },
    });

    const cancelled = await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        date,
        time: "15:00",
      },
      db
    );

    await db.appointment.update({
      where: { id: cancelled.id },
      data: { status: "CANCELLED" },
    });

    const availability = await getBookingAvailability(
      {
        barberId: barber.id,
        serviceIds: [corte.id],
        date,
        now: createScheduleDate(date, "08:00")!,
      },
      db
    );

    assert.equal(availability.periodSlots.afternoon.includes("13:00"), false);
    assert.equal(availability.periodSlots.afternoon.includes("13:10"), false);
    assert.equal(availability.periodSlots.afternoon.includes("15:00"), true);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("customer can reschedule and old slot becomes available", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte, pomada } = await createFixture(db, runId);
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);
    const testNow = createScheduleDate(date, "08:00")!;

    const appointment = await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        extras: [{ extraProductId: pomada.id, quantity: 1 }],
        date,
        time: "10:00",
        now: testNow,
      },
      db
    );

    const rescheduled = await rescheduleCustomerAppointment(
      {
        appointmentId: appointment.id,
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        extras: [{ extraProductId: pomada.id, quantity: 1 }],
        date,
        time: "11:00",
        now: testNow,
      },
      db
    );

    assert.equal(rescheduled.appointment.id, appointment.id);
    assert.equal(rescheduled.previousDate.getUTCHours(), 10);
    assert.equal(new Date(rescheduled.appointment.date).getUTCHours(), 11);
    assert.equal(rescheduled.appointment.items.length, 1);

    const productAfterReschedule = await db.extraProduct.findUniqueOrThrow({
      where: {
        id: pomada.id,
      },
    });
    assert.equal(productAfterReschedule.stock, 3);

    const availability = await getBookingAvailability(
      {
        barberId: barber.id,
        serviceIds: [corte.id],
        date,
        now: testNow,
      },
      db
    );

    assert.equal(availability.periodSlots.morning.includes("10:00"), true);
    assert.equal(availability.periodSlots.morning.includes("11:00"), false);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("customer can reserve extras and stock returns on cancellation", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte, pomada, bebida } = await createFixture(db, runId);
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    const appointment = await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        extras: [
          { extraProductId: pomada.id, quantity: 1 },
          { extraProductId: bebida.id, quantity: 2 },
        ],
        date,
        time: "11:00",
      },
      db
    );

    assert.equal(appointment.items.length, 2);

    const reservedProducts = await db.extraProduct.findMany({
      where: {
        id: {
          in: [pomada.id, bebida.id],
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    assert.equal(reservedProducts.find((product) => product.id === pomada.id)?.stock, 3);
    assert.equal(reservedProducts.find((product) => product.id === bebida.id)?.stock, 4);

    await cancelAppointmentByCustomer(
      {
        appointmentId: appointment.id,
        customerId: customer.id,
      },
      db
    );

    const restoredProducts = await db.extraProduct.findMany({
      where: {
        id: {
          in: [pomada.id, bebida.id],
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    assert.equal(restoredProducts.find((product) => product.id === pomada.id)?.stock, 4);
    assert.equal(restoredProducts.find((product) => product.id === bebida.id)?.stock, 6);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("barber reviews extras before completing and payout uses delivered items only", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte, pomada, bebida } = await createFixture(db, runId);
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    await db.extraProduct.updateMany({
      where: {
        id: {
          in: [pomada.id, bebida.id],
        },
      },
      data: {
        commissionType: "PERCENT",
        commissionValue: 50,
      },
    });

    const appointment = await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        extras: [
          { extraProductId: pomada.id, quantity: 1 },
          { extraProductId: bebida.id, quantity: 2 },
        ],
        date,
        time: "12:00",
      },
      db
    );

    await updateAppointmentStatusForBarber(
      {
        appointmentId: appointment.id,
        barberId: barber.id,
        status: "CONFIRMED",
      },
      db
    );

    await assert.rejects(
      () =>
        updateAppointmentStatusForBarber(
          {
            appointmentId: appointment.id,
            barberId: barber.id,
            status: "COMPLETED",
            paymentMethod: "PIX",
          },
          db
        ),
      AppointmentMutationError
    );

    const booked = await db.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: {
        items: true,
      },
    });
    const deliveredItem = booked.items.find((item) => item.extraProductId === pomada.id)!;
    const notDeliveredItem = booked.items.find((item) => item.extraProductId === bebida.id)!;

    await updateAppointmentStatusForBarber(
      {
        appointmentId: appointment.id,
        barberId: barber.id,
        status: "COMPLETED",
        paymentMethod: "PIX",
        itemDeliveryDecisions: [
          {
            appointmentItemId: deliveredItem.id,
            isDelivered: true,
          },
          {
            appointmentItemId: notDeliveredItem.id,
            isDelivered: false,
          },
        ],
      },
      db
    );

    const completed = await db.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: {
        items: true,
        services: true,
      },
    });
    const products = await db.extraProduct.findMany({
      where: {
        id: {
          in: [pomada.id, bebida.id],
        },
      },
    });
    const servicePayout = completed.services.reduce(
      (sum, service) => sum + toMoneyNumber(service.barberPayoutSnapshot),
      0
    );
    const deliveredPayout =
      toMoneyNumber(completed.items.find((item) => item.extraProductId === pomada.id)?.barberPayoutSnapshot) ||
      0;

    assert.equal(completed.status, "COMPLETED");
    assert.equal(completed.items.find((item) => item.extraProductId === pomada.id)?.isDelivered, true);
    assert.equal(completed.items.find((item) => item.extraProductId === bebida.id)?.isDelivered, false);
    assert.equal(products.find((product) => product.id === pomada.id)?.stock, 3);
    assert.equal(products.find((product) => product.id === bebida.id)?.stock, 6);
    assert.equal(
      getAppointmentTotalBarberPayout(completed.services, completed.items),
      servicePayout + deliveredPayout
    );
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("admin can change a completed appointment to no-show without double-returning extras", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte, pomada, bebida } = await createFixture(db, runId);
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    const appointment = await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        extras: [
          { extraProductId: pomada.id, quantity: 1 },
          { extraProductId: bebida.id, quantity: 2 },
        ],
        date,
        time: "13:00",
      },
      db
    );

    const booked = await db.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: { items: true },
    });
    const deliveredItem = booked.items.find((item) => item.extraProductId === pomada.id)!;
    const notDeliveredItem = booked.items.find((item) => item.extraProductId === bebida.id)!;

    await updateAppointmentStatusForBarber(
      {
        appointmentId: appointment.id,
        barberId: barber.id,
        status: "COMPLETED",
        paymentMethod: "PIX",
        itemDeliveryDecisions: [
          { appointmentItemId: deliveredItem.id, isDelivered: true },
          { appointmentItemId: notDeliveredItem.id, isDelivered: false },
        ],
      },
      db
    );

    await updateAppointmentStatusForAdmin(
      {
        appointmentId: appointment.id,
        status: "NO_SHOW",
      },
      db
    );

    const updated = await db.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: { items: true },
    });
    const products = await db.extraProduct.findMany({
      where: { id: { in: [pomada.id, bebida.id] } },
    });

    assert.equal(updated.status, "NO_SHOW");
    assert.equal(updated.paymentMethod, null);
    assert.equal(
      updated.items.every((item) => !item.isDelivered && item.deliveredAt === null),
      true
    );
    assert.equal(products.find((product) => product.id === pomada.id)?.stock, 4);
    assert.equal(products.find((product) => product.id === bebida.id)?.stock, 6);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});

test("admin can reopen a completed appointment and barber remains blocked", async () => {
  const { db, runId, cleanup } = await setupDatabase();

  try {
    const { barber, customer, corte, pomada, bebida } = await createFixture(db, runId);
    const nextDay = getNextBusinessDay();
    const date = nextDay.toISOString().slice(0, 10);

    const appointment = await createCustomerAppointment(
      {
        customerId: customer.id,
        barberId: barber.id,
        serviceIds: [corte.id],
        extras: [
          { extraProductId: pomada.id, quantity: 1 },
          { extraProductId: bebida.id, quantity: 2 },
        ],
        date,
        time: "14:00",
      },
      db
    );

    const booked = await db.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: { items: true },
    });
    const deliveredItem = booked.items.find((item) => item.extraProductId === pomada.id)!;
    const notDeliveredItem = booked.items.find((item) => item.extraProductId === bebida.id)!;

    await updateAppointmentStatusForBarber(
      {
        appointmentId: appointment.id,
        barberId: barber.id,
        status: "COMPLETED",
        paymentMethod: "PIX",
        itemDeliveryDecisions: [
          { appointmentItemId: deliveredItem.id, isDelivered: true },
          { appointmentItemId: notDeliveredItem.id, isDelivered: false },
        ],
      },
      db
    );

    await assert.rejects(
      () =>
        updateAppointmentStatusForBarber(
          {
            appointmentId: appointment.id,
            barberId: barber.id,
            status: "NO_SHOW",
          },
          db
        ),
      AppointmentMutationError
    );

    await updateAppointmentStatusForAdmin(
      {
        appointmentId: appointment.id,
        status: "CONFIRMED",
      },
      db
    );

    const reopened = await db.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: { items: true },
    });
    const products = await db.extraProduct.findMany({
      where: { id: { in: [pomada.id, bebida.id] } },
    });

    assert.equal(reopened.status, "CONFIRMED");
    assert.equal(reopened.paymentMethod, null);
    assert.equal(
      reopened.items.every((item) => !item.isDelivered && item.deliveredAt === null),
      true
    );
    assert.equal(products.find((product) => product.id === pomada.id)?.stock, 3);
    assert.equal(products.find((product) => product.id === bebida.id)?.stock, 4);
  } finally {
    await cleanup();
    await db.$disconnect();
  }
});
