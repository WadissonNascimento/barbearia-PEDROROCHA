import { Prisma, type PrismaClient } from "@prisma/client";
import {
  APPOINTMENT_STATUSES,
  normalizeAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/appointmentStatus";
import {
  normalizePaymentMethod,
  type AppointmentPaymentMethod,
} from "@/lib/paymentMethods";
import { registerExtraStockMovement } from "@/lib/extraInventory";
import {
  getAppointmentOccupiedDuration,
  getAppointmentServicesOccupiedDuration,
  isActiveAppointmentStatus,
  isBlockedByRecurringBlock,
  isBlockedPeriod,
  toMinutes,
} from "@/lib/barberSchedule";
import {
  calculateCommissionFinancials,
  calculateServiceFinancials,
  syncAppointmentFinancialSnapshots,
} from "@/lib/financials";
import { roundMoney, toMoneyNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { mergeManualFitInNotes } from "@/lib/manualFitIn";
import {
  createScheduleDate,
  formatScheduleTime,
  getScheduleDayOfWeek,
  getScheduleDateValue,
  getScheduleDayRange,
  getScheduleMinutes,
  isScheduleDateTimePast,
} from "@/lib/scheduleTime";

type AppointmentPrismaClient = Pick<
  PrismaClient,
  | "$transaction"
  | "$executeRaw"
  | "appointment"
  | "appointmentItem"
  | "appointmentService"
  | "barberAvailability"
  | "barberBlock"
  | "barberPayout"
  | "barberServiceCommission"
  | "extraProduct"
  | "extraStockMovement"
  | "recurringBarberBlock"
  | "service"
  | "user"
>;
type AppointmentTransactionClient = Omit<AppointmentPrismaClient, "$transaction">;

export class AppointmentMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentMutationError";
  }
}

export type CreateCustomerAppointmentInput = {
  customerId: string;
  barberId: string;
  serviceIds: string[];
  extras?: Array<{
    extraProductId: string;
    quantity: number;
  }>;
  date: string;
  time: string;
  notes?: string | null;
  now?: Date;
  conflictMode?: "OVERLAP" | "SAME_START_ONLY";
  manualDurationMinutes?: number | null;
};

export type RescheduleCustomerAppointmentInput = CreateCustomerAppointmentInput & {
  appointmentId: string;
};

export type CreateManualFitInAppointmentInput = CreateCustomerAppointmentInput;

export type AdminEditAppointmentInput = {
  appointmentId: string;
  barberId: string;
  serviceIds: string[];
  extras?: Array<{
    extraProductId: string;
    quantity: number;
  }>;
  date: string;
  time: string;
  notes?: string | null;
  now?: Date;
};

export type BarberEditOpenAppointmentInput = {
  appointmentId: string;
  barberId: string;
  serviceIds: string[];
  extras?: Array<{
    extraProductId: string;
    quantity: number;
  }>;
  notes?: string | null;
  now?: Date;
};

export type FinanceEditCompletedAppointmentInput = {
  appointmentId: string;
  actor: "ADMIN" | "BARBER";
  barberId?: string | null;
  shopId?: string | null;
  serviceIds: string[];
  extras?: Array<{
    extraProductId: string;
    quantity: number;
  }>;
  notes?: string | null;
  now?: Date;
};

export type AppointmentItemDeliveryDecision = {
  appointmentItemId: string;
  isDelivered: boolean;
};

const FINAL_APPOINTMENT_STATUSES = ["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"];

async function assertNoLockedPayoutForAppointmentPeriod(
  db: AppointmentTransactionClient,
  {
    shopId,
    barberId,
    date,
  }: {
    shopId: string;
    barberId: string;
    date: Date;
  }
) {
  const lockedPayout = await db.barberPayout.findFirst({
    where: {
      shopId,
      barberId,
      status: {
        in: ["CLOSED", "PAID"],
      },
      periodStart: {
        lte: date,
      },
      periodEnd: {
        gte: date,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (lockedPayout) {
    throw new AppointmentMutationError(
      "Esse periodo ja possui repasse fechado ou pago. Reabra o repasse antes de alterar o atendimento."
    );
  }
}

function getAppointmentDurationFromServices(
  services: Array<{
    duration: number;
    bufferAfter: number | null;
  }>
) {
  return getAppointmentServicesOccupiedDuration(
    services.map((service) => ({
      durationSnapshot: service.duration,
      bufferAfter: service.bufferAfter,
    }))
  );
}

async function getNextAppointmentPublicId(
  shopId: string,
  db: AppointmentTransactionClient
) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${shopId}), hashtext('appointment_public_id'))`;

  const latestAppointment = await db.appointment.findFirst({
    where: {
      shopId,
    },
    orderBy: {
      publicId: "desc",
    },
    select: {
      publicId: true,
    },
  });

  return (latestAppointment?.publicId || 0) + 1;
}

export async function createCustomerAppointment(
  input: CreateCustomerAppointmentInput,
  db: AppointmentPrismaClient = prisma
) {
  try {
    return await db.$transaction(
      (tx) => createCustomerAppointmentInTransaction(input, tx),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.code === "P2028")
    ) {
      throw new AppointmentMutationError(
        "Esse horario acabou de ser reservado. Escolha outro horario."
      );
    }

    throw error;
  }
}

export async function rescheduleCustomerAppointment(
  input: RescheduleCustomerAppointmentInput,
  db: AppointmentPrismaClient = prisma
) {
  try {
    return await db.$transaction(
      (tx) => rescheduleCustomerAppointmentInTransaction(input, tx),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.code === "P2028")
    ) {
      throw new AppointmentMutationError(
        "Esse horario acabou de ser reservado. Escolha outro horario."
      );
    }

    throw error;
  }
}

export async function editAppointmentForAdmin(
  input: AdminEditAppointmentInput,
  db: AppointmentPrismaClient = prisma
) {
  const currentAppointment = await db.appointment.findUnique({
    where: {
      id: input.appointmentId.trim(),
    },
    select: {
      customerId: true,
    },
  });

  if (!currentAppointment) {
    throw new AppointmentMutationError("Agendamento nao encontrado.");
  }

  try {
    return await db.$transaction(
      (tx) =>
        rescheduleCustomerAppointmentInTransaction(
          {
            appointmentId: input.appointmentId,
            customerId: currentAppointment.customerId,
            barberId: input.barberId,
            serviceIds: input.serviceIds,
            extras: input.extras,
            date: input.date,
            time: input.time,
            notes: input.notes,
            now: input.now,
          },
          tx,
          { actor: "ADMIN" }
        ),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.code === "P2028")
    ) {
      throw new AppointmentMutationError(
        "Esse horario acabou de ser reservado. Escolha outro horario."
      );
    }

    throw error;
  }
}

export async function editOpenAppointmentForBarber(
  input: BarberEditOpenAppointmentInput,
  db: AppointmentPrismaClient = prisma
) {
  const currentAppointment = await db.appointment.findUnique({
    where: {
      id: input.appointmentId.trim(),
    },
    select: {
      customerId: true,
      barberId: true,
      date: true,
    },
  });

  if (!currentAppointment || currentAppointment.barberId !== input.barberId) {
    throw new AppointmentMutationError(
      "Agendamento nao encontrado para este barbeiro."
    );
  }

  try {
    return await db.$transaction(
      (tx) =>
        rescheduleCustomerAppointmentInTransaction(
          {
            appointmentId: input.appointmentId,
            customerId: currentAppointment.customerId,
            barberId: currentAppointment.barberId,
            serviceIds: input.serviceIds,
            extras: input.extras,
            date: getScheduleDateValue(currentAppointment.date),
            time: formatScheduleTime(currentAppointment.date),
            notes: input.notes,
            now: input.now,
          },
          tx,
          { actor: "BARBER" }
        ),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.code === "P2028")
    ) {
      throw new AppointmentMutationError(
        "Esse horario acabou de ser reservado. Escolha outro horario."
      );
    }

    throw error;
  }
}

export async function editCompletedAppointmentFinancialItems(
  input: FinanceEditCompletedAppointmentInput,
  db: AppointmentPrismaClient = prisma
) {
  try {
    return await db.$transaction(
      (tx) => editCompletedAppointmentFinancialItemsInTransaction(input, tx),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.code === "P2028")
    ) {
      throw new AppointmentMutationError(
        "Esse atendimento acabou de ser atualizado. Tente novamente."
      );
    }

    throw error;
  }
}

export async function createManualFitInAppointment(
  input: CreateManualFitInAppointmentInput,
  db: AppointmentPrismaClient = prisma
) {
  try {
    return await db.$transaction(
      (tx) =>
        createCustomerAppointmentInTransaction(input, tx, {
          manualFitIn: true,
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.code === "P2028")
    ) {
      throw new AppointmentMutationError(
        "Esse horario acabou de ser reservado. Escolha outro horario."
      );
    }

    throw error;
  }
}

async function createCustomerAppointmentInTransaction(
  input: CreateCustomerAppointmentInput,
  db: AppointmentTransactionClient,
  options: { manualFitIn?: boolean } = {}
) {
  const manualFitIn = Boolean(options.manualFitIn);
  const customerId = input.customerId.trim();
  const barberId = input.barberId.trim();
  const serviceIds = input.serviceIds.map((serviceId) => serviceId.trim()).filter(Boolean);
  const extras = (input.extras || [])
    .map((extra) => ({
      extraProductId: extra.extraProductId.trim(),
      quantity: Number(extra.quantity),
    }))
    .filter(
      (extra) => extra.extraProductId && Number.isInteger(extra.quantity) && extra.quantity > 0
    );
  const date = input.date.trim();
  const time = input.time.trim();
  const notes = input.notes?.trim() || null;
  const conflictMode = input.conflictMode || "OVERLAP";

  if (!customerId || !barberId || serviceIds.length === 0 || !date || !time) {
    throw new AppointmentMutationError(
      "Selecione barbeiro, servicos, data e horario para continuar."
    );
  }

  if (serviceIds.length > 8 || extras.length > 12 || (notes && notes.length > 400)) {
    throw new AppointmentMutationError("Os dados do agendamento excedem o tamanho permitido.");
  }

  const extrasByProductId = new Map<string, number>();
  for (const extra of extras) {
    extrasByProductId.set(
      extra.extraProductId,
      (extrasByProductId.get(extra.extraProductId) || 0) + extra.quantity
    );
  }

  const barber = await db.user.findFirst({
    where: {
      id: barberId,
      role: "BARBER",
      isActive: true,
    },
  });

  if (!barber) {
    throw new AppointmentMutationError("O barbeiro selecionado nao esta mais disponivel.");
  }

  const shopId = barber.shopId;

  const customer = await db.user.findFirst({
    where: {
      id: customerId,
      shopId,
      role: "CUSTOMER",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!customer) {
    throw new AppointmentMutationError("Cliente nao autorizado para esta barbearia.");
  }

  const availableServices = await db.service.findMany({
    where: {
      shopId,
      id: {
        in: serviceIds,
      },
      OR: [{ barberId }, { barberId: null }],
      isActive: true,
    },
  });

  if (availableServices.length !== serviceIds.length) {
    throw new AppointmentMutationError(
      "Um ou mais servicos escolhidos nao estao disponiveis para esse barbeiro."
    );
  }

  const serviceMap = new Map(availableServices.map((service) => [service.id, service] as const));
  const orderedServices = serviceIds
    .map((serviceId) => serviceMap.get(serviceId))
    .filter(
      (
        service
      ): service is (typeof availableServices)[number] => Boolean(service)
    );

  if (orderedServices.length !== serviceIds.length) {
    throw new AppointmentMutationError(
      "Nao foi possivel validar a ordem dos servicos selecionados."
    );
  }

  const barberServiceCommissions = await db.barberServiceCommission.findMany({
    where: {
      shopId,
      barberId,
      serviceId: {
        in: serviceIds,
      },
    },
  });
  const commissionByServiceId = new Map(
    barberServiceCommissions.map((commission) => [commission.serviceId, commission] as const)
  );

  const selectedProducts = extrasByProductId.size
      ? await db.extraProduct.findMany({
        where: {
          shopId,
          id: {
            in: Array.from(extrasByProductId.keys()),
          },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          commissionType: true,
          commissionValue: true,
        },
      })
    : [];

  if (selectedProducts.length !== extrasByProductId.size) {
    throw new AppointmentMutationError(
      "Um ou mais extras escolhidos nao estao mais disponiveis."
    );
  }

  for (const product of selectedProducts) {
    const selectedQuantity = extrasByProductId.get(product.id) || 0;

    if (selectedQuantity > product.stock) {
      throw new AppointmentMutationError(
        `${product.name} nao possui estoque suficiente para esse agendamento.`
      );
    }
  }

  const appointmentDate = createScheduleDate(date, time);

  if (!appointmentDate) {
    throw new AppointmentMutationError("Data ou horario invalido.");
  }

  const now = input.now ?? new Date();
  const normalizedManualDurationMinutes =
    input.manualDurationMinutes &&
    Number.isInteger(input.manualDurationMinutes) &&
    input.manualDurationMinutes >= 5 &&
    input.manualDurationMinutes <= 240
      ? input.manualDurationMinutes
      : null;

  if (!manualFitIn && isScheduleDateTimePast(appointmentDate, now)) {
    throw new AppointmentMutationError("Nao e possivel agendar em um horario que ja passou.");
  }

  const dayOfWeek = getScheduleDayOfWeek(date);
  const dayRange = getScheduleDayRange(date);

  if (dayOfWeek === null || !dayRange) {
    throw new AppointmentMutationError("Data ou horario invalido.");
  }

  const { start: dayStart, end: dayEnd } = dayRange;

  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${barberId}), hashtext(${date}))`;

  const sameDayAppointments = await db.appointment.findMany({
    where: {
      shopId,
      barberId,
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    include: {
      services: true,
    },
  });

  if (!manualFitIn) {
    const [availability, blocks, recurringBlocks] = await Promise.all([
      db.barberAvailability.findFirst({
        where: {
          shopId,
          barberId,
          weekDay: dayOfWeek,
          isActive: true,
        },
      }),
      db.barberBlock.findMany({
        where: {
          shopId,
          barberId,
          startDateTime: {
            lte: dayEnd,
          },
          endDateTime: {
            gte: dayStart,
          },
        },
      }),
      db.recurringBarberBlock.findMany({
        where: {
          shopId,
          barberId,
          weekDay: dayOfWeek,
          isActive: true,
        },
      }),
    ]);

    if (!availability) {
      throw new AppointmentMutationError("Este barbeiro nao atende nesse dia.");
    }

    const occupiedDuration =
      normalizedManualDurationMinutes || getAppointmentDurationFromServices(orderedServices);
    const selectedStartMinutes = toMinutes(time);
    const selectedEndMinutes = selectedStartMinutes + occupiedDuration;
    const availabilityStart = toMinutes(availability.startTime);
    const availabilityEnd = toMinutes(availability.endTime);

    if (selectedStartMinutes < availabilityStart || selectedEndMinutes > availabilityEnd) {
      throw new AppointmentMutationError(
        "O horario escolhido esta fora da disponibilidade do barbeiro."
      );
    }

    const endDate = new Date(appointmentDate.getTime() + occupiedDuration * 60000);

    if (isBlockedPeriod(appointmentDate, endDate, blocks)) {
      throw new AppointmentMutationError("O horario escolhido esta bloqueado pelo barbeiro.");
    }

    if (isBlockedByRecurringBlock(selectedStartMinutes, selectedEndMinutes, recurringBlocks)) {
      throw new AppointmentMutationError(
        "O horario escolhido entra em um bloqueio recorrente do barbeiro."
      );
    }
  }

  const occupiedDuration =
    normalizedManualDurationMinutes || getAppointmentDurationFromServices(orderedServices);
  const selectedStartMinutes = toMinutes(time);
  const selectedEndMinutes = selectedStartMinutes + occupiedDuration;

  const conflict = sameDayAppointments.some((appointment) => {
    if (!isActiveAppointmentStatus(appointment.status)) {
      return false;
    }

    const existingDate = new Date(appointment.date);
    const existingStartMinutes = getScheduleMinutes(existingDate);

    if (conflictMode === "SAME_START_ONLY") {
      return selectedStartMinutes === existingStartMinutes;
    }

    const existingEndMinutes = existingStartMinutes + getAppointmentOccupiedDuration(appointment);

    return selectedStartMinutes < existingEndMinutes && selectedEndMinutes > existingStartMinutes;
  });

  if (conflict) {
    throw new AppointmentMutationError(
      "Esse horario acabou de ser reservado. Escolha outro horario."
    );
  }

  const publicId = await getNextAppointmentPublicId(shopId, db);

  const appointment = await db.appointment.create({
    data: {
      shopId,
      publicId,
      barberId,
      customerId,
      date: appointmentDate,
      notes,
      isManualFitIn: manualFitIn,
      manualDurationMinutes: normalizedManualDurationMinutes,
      status: "CONFIRMED",
      services: {
        create: orderedServices.map((service, index) => {
          const barberCommission = commissionByServiceId.get(service.id);
          const financials = calculateServiceFinancials({
            price: service.price,
            commissionType: barberCommission?.commissionType || service.commissionType,
            commissionValue: barberCommission?.commissionValue ?? service.commissionValue,
          });

          return {
            shopId,
            serviceId: service.id,
            orderIndex: index,
            nameSnapshot: service.name,
            priceSnapshot: service.price,
            durationSnapshot: service.duration,
            bufferAfter: service.bufferAfter || 0,
            commissionTypeSnapshot: financials.commissionType,
            commissionValueSnapshot: financials.commissionValue,
            barberPayoutSnapshot: financials.barberPayout,
            shopRevenueSnapshot: financials.shopRevenue,
          };
        }),
      },
    },
    include: {
      items: true,
      services: true,
      barber: true,
      customer: true,
    },
  });

  if (selectedProducts.length > 0) {
    for (const product of selectedProducts) {
      const quantity = extrasByProductId.get(product.id) || 0;
      const updated = await db.extraProduct.updateMany({
        where: {
          id: product.id,
          isActive: true,
          stock: {
            gte: quantity,
          },
        },
        data: {
          stock: {
            decrement: quantity,
          },
        },
      });

      if (updated.count === 0) {
        throw new AppointmentMutationError(
          `${product.name} acabou de ficar sem estoque. Tente novamente.`
        );
      }
    }

    await db.appointmentItem.createMany({
      data: selectedProducts.map((product) => {
        const quantity = extrasByProductId.get(product.id) || 0;
        const unitFinancials = calculateCommissionFinancials({
          price: product.price,
          commissionType: product.commissionType,
          commissionValue: product.commissionValue,
        });
        const productPrice = toMoneyNumber(product.price);
        const barberPayout = roundMoney(unitFinancials.barberPayout * quantity);
        const shopRevenue = roundMoney(unitFinancials.shopRevenue * quantity);

        return {
          shopId,
          appointmentId: appointment.id,
          extraProductId: product.id,
          productNameSnapshot: product.name,
          quantity,
          unitPrice: productPrice,
          subtotal: roundMoney(productPrice * quantity),
          commissionTypeSnapshot: unitFinancials.commissionType,
          commissionValueSnapshot: unitFinancials.commissionValue,
          barberPayoutSnapshot: barberPayout,
          shopRevenueSnapshot: shopRevenue,
        };
      }),
    });

    for (const product of selectedProducts) {
      const quantity = extrasByProductId.get(product.id) || 0;
      await registerExtraStockMovement(
        {
          extraProductId: product.id,
          shopId,
          type: "RESERVE_OUT",
          quantity,
          reason: `Reserva em agendamento ${appointment.id}`,
        },
        db
      );
    }
  }

  return db.appointment.findUniqueOrThrow({
    where: {
      id: appointment.id,
    },
    include: {
      items: true,
      services: true,
      barber: true,
      customer: true,
    },
  });
}

async function rescheduleCustomerAppointmentInTransaction(
  input: RescheduleCustomerAppointmentInput,
  db: AppointmentTransactionClient,
  options: { actor?: "CUSTOMER" | "ADMIN" | "BARBER" } = {}
) {
  const actor = options.actor || "CUSTOMER";
  const appointmentId = input.appointmentId.trim();
  const customerId = input.customerId.trim();
  const barberId = input.barberId.trim();
  const serviceIds = input.serviceIds.map((serviceId) => serviceId.trim()).filter(Boolean);
  const extras = (input.extras || [])
    .map((extra) => ({
      extraProductId: extra.extraProductId.trim(),
      quantity: Number(extra.quantity),
    }))
    .filter(
      (extra) => extra.extraProductId && Number.isInteger(extra.quantity) && extra.quantity > 0
    );
  const date = input.date.trim();
  const time = input.time.trim();
  const notes = input.notes?.trim() || null;
  const conflictMode = input.conflictMode || "OVERLAP";

  if (!appointmentId || !customerId || !barberId || serviceIds.length === 0 || !date || !time) {
    throw new AppointmentMutationError(
      "Selecione barbeiro, servicos, data e horario para remarcar."
    );
  }

  if (serviceIds.length > 8 || extras.length > 12 || (notes && notes.length > 400)) {
    throw new AppointmentMutationError("Os dados do agendamento excedem o tamanho permitido.");
  }

  const currentAppointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      items: true,
      services: true,
    },
  });

  if (
    !currentAppointment ||
    (actor === "CUSTOMER" &&
      (currentAppointment.customerId !== customerId ||
        currentAppointment.isManualFitIn))
  ) {
    throw new AppointmentMutationError("Agendamento nao encontrado para sua conta.");
  }

  const currentStatus = normalizeAppointmentStatus(currentAppointment.status);

  if (FINAL_APPOINTMENT_STATUSES.includes(currentStatus)) {
    throw new AppointmentMutationError(
      actor === "ADMIN"
        ? "Esse atendimento ja foi finalizado e nao permite edicao operacional."
        : actor === "BARBER"
        ? "Esse atendimento ja foi finalizado e nao permite edicao pelo barbeiro."
        : "Esse agendamento nao pode mais ser remarcado."
    );
  }

  const now = input.now ?? new Date();

  const extrasByProductId = new Map<string, number>();
  for (const extra of extras) {
    extrasByProductId.set(
      extra.extraProductId,
      (extrasByProductId.get(extra.extraProductId) || 0) + extra.quantity
    );
  }

  const currentReservedByProductId = new Map<string, number>();
  for (const item of currentAppointment.items) {
    currentReservedByProductId.set(
      item.extraProductId,
      (currentReservedByProductId.get(item.extraProductId) || 0) + item.quantity
    );
  }

  const barber = await db.user.findFirst({
    where: {
      id: barberId,
      role: "BARBER",
      isActive: true,
    },
  });

  if (!barber) {
    throw new AppointmentMutationError("O barbeiro selecionado nao esta mais disponivel.");
  }

  const shopId = barber.shopId;

  if (currentAppointment.shopId !== shopId) {
    throw new AppointmentMutationError("Agendamento nao encontrado para esta barbearia.");
  }

  const customer = await db.user.findFirst({
    where: {
      id: customerId,
      shopId,
      role: "CUSTOMER",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!customer) {
    throw new AppointmentMutationError("Cliente nao autorizado para esta barbearia.");
  }

  await assertNoLockedPayoutForAppointmentPeriod(db, {
    shopId: currentAppointment.shopId,
    barberId: currentAppointment.barberId,
    date: currentAppointment.date,
  });

  const availableServices = await db.service.findMany({
    where: {
      shopId,
      id: {
        in: serviceIds,
      },
      OR: [{ barberId }, { barberId: null }],
      isActive: true,
    },
  });

  if (availableServices.length !== serviceIds.length) {
    throw new AppointmentMutationError(
      "Um ou mais servicos escolhidos nao estao disponiveis para esse barbeiro."
    );
  }

  const serviceMap = new Map(availableServices.map((service) => [service.id, service] as const));
  const orderedServices = serviceIds
    .map((serviceId) => serviceMap.get(serviceId))
    .filter(
      (
        service
      ): service is (typeof availableServices)[number] => Boolean(service)
    );

  if (orderedServices.length !== serviceIds.length) {
    throw new AppointmentMutationError(
      "Nao foi possivel validar a ordem dos servicos selecionados."
    );
  }

  const barberServiceCommissions = await db.barberServiceCommission.findMany({
    where: {
      shopId,
      barberId,
      serviceId: {
        in: serviceIds,
      },
    },
  });
  const commissionByServiceId = new Map(
    barberServiceCommissions.map((commission) => [commission.serviceId, commission] as const)
  );

  const selectedProducts = extrasByProductId.size
      ? await db.extraProduct.findMany({
        where: {
          shopId,
          id: {
            in: Array.from(extrasByProductId.keys()),
          },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          commissionType: true,
          commissionValue: true,
        },
      })
    : [];

  if (selectedProducts.length !== extrasByProductId.size) {
    throw new AppointmentMutationError(
      "Um ou mais extras escolhidos nao estao mais disponiveis."
    );
  }

  for (const product of selectedProducts) {
    const selectedQuantity = extrasByProductId.get(product.id) || 0;
    const quantityAlreadyReserved = currentReservedByProductId.get(product.id) || 0;
    const availableStock = product.stock + quantityAlreadyReserved;

    if (selectedQuantity > availableStock) {
      throw new AppointmentMutationError(
        `${product.name} nao possui estoque suficiente para esse agendamento.`
      );
    }
  }

  const appointmentDate = createScheduleDate(date, time);

  if (!appointmentDate) {
    throw new AppointmentMutationError("Data ou horario invalido.");
  }

  const isChangingSchedule =
    currentAppointment.barberId !== barberId ||
    currentAppointment.date.getTime() !== appointmentDate.getTime();

  if (
    isScheduleDateTimePast(appointmentDate, now) &&
    (actor === "CUSTOMER" || isChangingSchedule)
  ) {
    throw new AppointmentMutationError("Nao e possivel remarcar para um horario que ja passou.");
  }

  if (isChangingSchedule) {
    await assertNoLockedPayoutForAppointmentPeriod(db, {
      shopId,
      barberId,
      date: appointmentDate,
    });
  }

  const shouldValidateScheduleCapacity = isChangingSchedule;

  const dayOfWeek = getScheduleDayOfWeek(date);
  const dayRange = getScheduleDayRange(date);

  if (dayOfWeek === null || !dayRange) {
    throw new AppointmentMutationError("Data ou horario invalido.");
  }

  const { start: dayStart, end: dayEnd } = dayRange;

  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${barberId}), hashtext(${date}))`;

  const [availability, sameDayAppointments, blocks, recurringBlocks] = await Promise.all([
    db.barberAvailability.findFirst({
      where: {
        shopId,
        barberId,
        weekDay: dayOfWeek,
        isActive: true,
      },
    }),
    db.appointment.findMany({
      where: {
        shopId,
        barberId,
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        services: true,
      },
    }),
    db.barberBlock.findMany({
      where: {
        shopId,
        barberId,
        startDateTime: {
          lte: dayEnd,
        },
        endDateTime: {
          gte: dayStart,
        },
      },
    }),
    db.recurringBarberBlock.findMany({
      where: {
        shopId,
        barberId,
        weekDay: dayOfWeek,
        isActive: true,
      },
    }),
  ]);

  if (shouldValidateScheduleCapacity) {
    if (!availability) {
      throw new AppointmentMutationError("Este barbeiro nao atende nesse dia.");
    }

    const selectedOccupiedDuration = getAppointmentDurationFromServices(orderedServices);
    const selectedStartMinutes = toMinutes(time);
    const selectedEndMinutes = selectedStartMinutes + selectedOccupiedDuration;
    const availabilityStart = toMinutes(availability.startTime);
    const availabilityEnd = toMinutes(availability.endTime);

    if (selectedStartMinutes < availabilityStart || selectedEndMinutes > availabilityEnd) {
      throw new AppointmentMutationError(
        "O horario escolhido esta fora da disponibilidade do barbeiro."
      );
    }

    const endDate = new Date(appointmentDate.getTime() + selectedOccupiedDuration * 60000);

    if (isBlockedPeriod(appointmentDate, endDate, blocks)) {
      throw new AppointmentMutationError("O horario escolhido esta bloqueado pelo barbeiro.");
    }

    if (isBlockedByRecurringBlock(selectedStartMinutes, selectedEndMinutes, recurringBlocks)) {
      throw new AppointmentMutationError(
        "O horario escolhido entra em um bloqueio recorrente do barbeiro."
      );
    }

    const conflict = sameDayAppointments.some((appointment) => {
      if (appointment.id === appointmentId || !isActiveAppointmentStatus(appointment.status)) {
        return false;
      }

      const existingDate = new Date(appointment.date);
      const existingStartMinutes = getScheduleMinutes(existingDate);

      if (conflictMode === "SAME_START_ONLY") {
        return selectedStartMinutes === existingStartMinutes;
      }

      const existingEndMinutes =
        existingStartMinutes + getAppointmentOccupiedDuration(appointment);

      return selectedStartMinutes < existingEndMinutes && selectedEndMinutes > existingStartMinutes;
    });

    if (conflict) {
      throw new AppointmentMutationError(
        "Esse horario acabou de ser reservado. Escolha outro horario."
      );
    }
  }

  for (const item of currentAppointment.items) {
    await db.extraProduct.update({
      where: {
        id: item.extraProductId,
      },
      data: {
        stock: {
          increment: item.quantity,
        },
      },
    });

    await registerExtraStockMovement(
      {
        extraProductId: item.extraProductId,
        shopId,
        type: "RESCHEDULE_RETURN",
        quantity: item.quantity,
        reason: `Devolucao por remarcacao do agendamento ${appointmentId}`,
      },
      db
    );
  }

  await db.appointmentItem.deleteMany({
    where: {
      appointmentId,
    },
  });

  await db.appointmentService.deleteMany({
    where: {
      appointmentId,
    },
  });

  await db.appointment.update({
    where: { id: appointmentId },
    data: {
      barberId,
      date: appointmentDate,
      notes: currentAppointment.isManualFitIn
        ? mergeManualFitInNotes({
            currentNotes: currentAppointment.notes,
            nextVisibleNotes: notes,
          })
        : notes ?? currentAppointment.notes,
      status: "CONFIRMED",
      reminderSentAt: null,
    },
  });

  await db.appointmentService.createMany({
    data: orderedServices.map((service, index) => {
      const barberCommission = commissionByServiceId.get(service.id);
      const financials = calculateServiceFinancials({
        price: service.price,
        commissionType: barberCommission?.commissionType || service.commissionType,
        commissionValue: barberCommission?.commissionValue ?? service.commissionValue,
      });

      return {
        shopId,
        appointmentId,
        serviceId: service.id,
        orderIndex: index,
        nameSnapshot: service.name,
        priceSnapshot: service.price,
        durationSnapshot: service.duration,
        bufferAfter: service.bufferAfter || 0,
        commissionTypeSnapshot: financials.commissionType,
        commissionValueSnapshot: financials.commissionValue,
        barberPayoutSnapshot: financials.barberPayout,
        shopRevenueSnapshot: financials.shopRevenue,
      };
    }),
  });

  if (selectedProducts.length > 0) {
    for (const product of selectedProducts) {
      const quantity = extrasByProductId.get(product.id) || 0;
      const updated = await db.extraProduct.updateMany({
        where: {
          id: product.id,
          isActive: true,
          stock: {
            gte: quantity,
          },
        },
        data: {
          stock: {
            decrement: quantity,
          },
        },
      });

      if (updated.count === 0) {
        throw new AppointmentMutationError(
          `${product.name} acabou de ficar sem estoque. Tente novamente.`
        );
      }
    }

    await db.appointmentItem.createMany({
      data: selectedProducts.map((product) => {
        const quantity = extrasByProductId.get(product.id) || 0;
        const unitFinancials = calculateCommissionFinancials({
          price: product.price,
          commissionType: product.commissionType,
          commissionValue: product.commissionValue,
        });
        const productPrice = toMoneyNumber(product.price);
        const barberPayout = roundMoney(unitFinancials.barberPayout * quantity);
        const shopRevenue = roundMoney(unitFinancials.shopRevenue * quantity);

        return {
          shopId,
          appointmentId,
          extraProductId: product.id,
          productNameSnapshot: product.name,
          quantity,
          unitPrice: productPrice,
          subtotal: roundMoney(productPrice * quantity),
          commissionTypeSnapshot: unitFinancials.commissionType,
          commissionValueSnapshot: unitFinancials.commissionValue,
          barberPayoutSnapshot: barberPayout,
          shopRevenueSnapshot: shopRevenue,
        };
      }),
    });

    for (const product of selectedProducts) {
      const quantity = extrasByProductId.get(product.id) || 0;
      await registerExtraStockMovement(
        {
          extraProductId: product.id,
          shopId,
          type: "RESCHEDULE_RESERVE_OUT",
          quantity,
          reason: `Reserva em remarcacao do agendamento ${appointmentId}`,
        },
        db
      );
    }
  }

  const appointment = await db.appointment.findUniqueOrThrow({
    where: {
      id: appointmentId,
    },
    include: {
      items: true,
      services: true,
      barber: true,
      customer: true,
    },
  });

  return {
    appointment,
    previousDate: currentAppointment.date,
  };
}

async function editCompletedAppointmentFinancialItemsInTransaction(
  input: FinanceEditCompletedAppointmentInput,
  db: AppointmentTransactionClient
) {
  const appointmentId = input.appointmentId.trim();
  const serviceIds = input.serviceIds.map((serviceId) => serviceId.trim()).filter(Boolean);
  const extras = (input.extras || [])
    .map((extra) => ({
      extraProductId: extra.extraProductId.trim(),
      quantity: Number(extra.quantity),
    }))
    .filter(
      (extra) => extra.extraProductId && Number.isInteger(extra.quantity) && extra.quantity > 0
    );
  const notes = input.notes?.trim() || null;

  if (!appointmentId || serviceIds.length === 0) {
    throw new AppointmentMutationError(
      "Selecione os servicos do atendimento para atualizar o financeiro."
    );
  }

  if (serviceIds.length > 8 || extras.length > 12 || (notes && notes.length > 400)) {
    throw new AppointmentMutationError("Os dados do atendimento excedem o tamanho permitido.");
  }

  const currentAppointment = await db.appointment.findUnique({
    where: {
      id: appointmentId,
    },
    include: {
      items: true,
      services: true,
    },
  });

  if (!currentAppointment) {
    throw new AppointmentMutationError("Atendimento nao encontrado.");
  }

  const currentStatus = normalizeAppointmentStatus(currentAppointment.status);

  if (!["COMPLETED", "DONE"].includes(currentStatus)) {
    throw new AppointmentMutationError(
      "Esse ajuste financeiro so pode ser feito em atendimentos concluidos."
    );
  }

  if (input.actor === "BARBER" && currentAppointment.barberId !== input.barberId) {
    throw new AppointmentMutationError(
      "Atendimento nao encontrado para este barbeiro."
    );
  }

  if (input.actor === "ADMIN" && input.shopId && currentAppointment.shopId !== input.shopId) {
    throw new AppointmentMutationError("Atendimento nao encontrado para esta barbearia.");
  }

  const shopId = currentAppointment.shopId;
  const barberId = currentAppointment.barberId;

  await assertNoLockedPayoutForAppointmentPeriod(db, {
    shopId,
    barberId,
    date: currentAppointment.date,
  });

  const barber = await db.user.findFirst({
    where: {
      id: barberId,
      shopId,
      role: "BARBER",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!barber) {
    throw new AppointmentMutationError("O barbeiro desse atendimento nao esta ativo.");
  }

  const extrasByProductId = new Map<string, number>();
  for (const extra of extras) {
    extrasByProductId.set(
      extra.extraProductId,
      (extrasByProductId.get(extra.extraProductId) || 0) + extra.quantity
    );
  }

  const currentReservedByProductId = new Map<string, number>();
  for (const item of currentAppointment.items) {
    currentReservedByProductId.set(
      item.extraProductId,
      (currentReservedByProductId.get(item.extraProductId) || 0) + item.quantity
    );
  }
  const currentServiceIds = currentAppointment.services.map((service) => service.serviceId);
  const currentExtraProductIds = currentAppointment.items.map((item) => item.extraProductId);

  const availableServices = await db.service.findMany({
    where: {
      shopId,
      id: {
        in: serviceIds,
      },
      OR: [{ barberId }, { barberId: null }],
      AND: [
        {
          OR: [
            { isActive: true },
            ...(currentServiceIds.length ? [{ id: { in: currentServiceIds } }] : []),
          ],
        },
      ],
    },
  });

  if (availableServices.length !== serviceIds.length) {
    throw new AppointmentMutationError(
      "Um ou mais servicos escolhidos nao estao disponiveis para esse barbeiro."
    );
  }

  const serviceMap = new Map(availableServices.map((service) => [service.id, service] as const));
  const orderedServices = serviceIds
    .map((serviceId) => serviceMap.get(serviceId))
    .filter(
      (
        service
      ): service is (typeof availableServices)[number] => Boolean(service)
    );

  if (orderedServices.length !== serviceIds.length) {
    throw new AppointmentMutationError(
      "Nao foi possivel validar a ordem dos servicos selecionados."
    );
  }

  const barberServiceCommissions = await db.barberServiceCommission.findMany({
    where: {
      shopId,
      barberId,
      serviceId: {
        in: serviceIds,
      },
    },
  });
  const commissionByServiceId = new Map(
    barberServiceCommissions.map((commission) => [commission.serviceId, commission] as const)
  );

  const selectedProducts = extrasByProductId.size
    ? await db.extraProduct.findMany({
        where: {
          shopId,
          id: {
            in: Array.from(extrasByProductId.keys()),
          },
          OR: [
            { isActive: true },
            ...(currentExtraProductIds.length ? [{ id: { in: currentExtraProductIds } }] : []),
          ],
        },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          commissionType: true,
          commissionValue: true,
        },
      })
    : [];

  if (selectedProducts.length !== extrasByProductId.size) {
    throw new AppointmentMutationError(
      "Um ou mais extras escolhidos nao estao mais disponiveis."
    );
  }

  for (const product of selectedProducts) {
    const selectedQuantity = extrasByProductId.get(product.id) || 0;
    const quantityAlreadyReserved = currentReservedByProductId.get(product.id) || 0;
    const availableStock = product.stock + quantityAlreadyReserved;

    if (selectedQuantity > availableStock) {
      throw new AppointmentMutationError(
        `${product.name} nao possui estoque suficiente para esse atendimento.`
      );
    }
  }

  for (const item of currentAppointment.items) {
    await db.extraProduct.update({
      where: {
        id: item.extraProductId,
      },
      data: {
        stock: {
          increment: item.quantity,
        },
      },
    });

    await registerExtraStockMovement(
      {
        extraProductId: item.extraProductId,
        shopId,
        type: "FINANCE_EDIT_RETURN",
        quantity: item.quantity,
        reason: `Ajuste financeiro do atendimento ${appointmentId}`,
      },
      db
    );
  }

  await db.appointmentItem.deleteMany({
    where: {
      appointmentId,
    },
  });

  await db.appointmentService.deleteMany({
    where: {
      appointmentId,
    },
  });

  await db.appointment.update({
    where: { id: appointmentId },
    data: {
      notes: currentAppointment.isManualFitIn
        ? mergeManualFitInNotes({
            currentNotes: currentAppointment.notes,
            nextVisibleNotes: notes,
          })
        : notes ?? currentAppointment.notes,
    },
  });

  await db.appointmentService.createMany({
    data: orderedServices.map((service, index) => {
      const barberCommission = commissionByServiceId.get(service.id);
      const financials = calculateServiceFinancials({
        price: service.price,
        commissionType: barberCommission?.commissionType || service.commissionType,
        commissionValue: barberCommission?.commissionValue ?? service.commissionValue,
      });

      return {
        shopId,
        appointmentId,
        serviceId: service.id,
        orderIndex: index,
        nameSnapshot: service.name,
        priceSnapshot: service.price,
        durationSnapshot: service.duration,
        bufferAfter: service.bufferAfter || 0,
        commissionTypeSnapshot: financials.commissionType,
        commissionValueSnapshot: financials.commissionValue,
        barberPayoutSnapshot: financials.barberPayout,
        shopRevenueSnapshot: financials.shopRevenue,
      };
    }),
  });

  if (selectedProducts.length > 0) {
    for (const product of selectedProducts) {
      const quantity = extrasByProductId.get(product.id) || 0;
      const updated = await db.extraProduct.updateMany({
        where: {
          id: product.id,
          stock: {
            gte: quantity,
          },
        },
        data: {
          stock: {
            decrement: quantity,
          },
        },
      });

      if (updated.count === 0) {
        throw new AppointmentMutationError(
          `${product.name} acabou de ficar sem estoque. Tente novamente.`
        );
      }
    }

    const deliveredAt = input.now ?? new Date();

    await db.appointmentItem.createMany({
      data: selectedProducts.map((product) => {
        const quantity = extrasByProductId.get(product.id) || 0;
        const unitFinancials = calculateCommissionFinancials({
          price: product.price,
          commissionType: product.commissionType,
          commissionValue: product.commissionValue,
        });
        const productPrice = toMoneyNumber(product.price);
        const barberPayout = roundMoney(unitFinancials.barberPayout * quantity);
        const shopRevenue = roundMoney(unitFinancials.shopRevenue * quantity);

        return {
          shopId,
          appointmentId,
          extraProductId: product.id,
          productNameSnapshot: product.name,
          quantity,
          unitPrice: productPrice,
          subtotal: roundMoney(productPrice * quantity),
          commissionTypeSnapshot: unitFinancials.commissionType,
          commissionValueSnapshot: unitFinancials.commissionValue,
          barberPayoutSnapshot: barberPayout,
          shopRevenueSnapshot: shopRevenue,
          isDelivered: true,
          deliveredAt,
        };
      }),
    });

    for (const product of selectedProducts) {
      const quantity = extrasByProductId.get(product.id) || 0;
      await registerExtraStockMovement(
        {
          extraProductId: product.id,
          shopId,
          type: "FINANCE_EDIT_RESERVE_OUT",
          quantity,
          reason: `Ajuste financeiro do atendimento ${appointmentId}`,
        },
        db
      );
    }
  }

  return db.appointment.findUniqueOrThrow({
    where: {
      id: appointmentId,
    },
    include: {
      items: true,
      services: true,
      barber: true,
      customer: true,
    },
  });
}

export async function updateAppointmentStatusForBarber(
  {
    appointmentId,
    barberId,
    status,
    paymentMethod,
    cancellationReason,
    itemDeliveryDecisions,
  }: {
    appointmentId: string;
    barberId: string;
    status: string;
    paymentMethod?: string | null;
    cancellationReason?: string | null;
    itemDeliveryDecisions?: AppointmentItemDeliveryDecision[];
  },
  db: AppointmentPrismaClient = prisma
) {
  const normalizedStatus = normalizeAppointmentStatus(status) as AppointmentStatus;
  const normalizedCancellationReason = cancellationReason?.trim() || "";
  const normalizedPaymentMethod =
    normalizedStatus === "COMPLETED"
      ? normalizePaymentMethod(paymentMethod)
      : null;

  if (!appointmentId || !APPOINTMENT_STATUSES.includes(normalizedStatus)) {
    throw new AppointmentMutationError("Status de agendamento invalido.");
  }

  if (normalizedStatus === "CANCELLED" && !normalizedCancellationReason) {
    throw new AppointmentMutationError("Informe o motivo do cancelamento.");
  }

  if (normalizedStatus === "COMPLETED" && !normalizedPaymentMethod) {
    throw new AppointmentMutationError(
      "Escolha Pix, dinheiro ou cartao antes de concluir."
    );
  }

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment || appointment.barberId !== barberId) {
    throw new AppointmentMutationError(
      "Agendamento nao encontrado para este barbeiro."
    );
  }

  const updatedAppointment = await db.$transaction(
    (tx) =>
      updateAppointmentStatusWithSideEffects(
        {
          appointmentId,
          nextStatus: normalizedStatus,
          paymentMethod: normalizedPaymentMethod,
          cancellationReason:
            normalizedStatus === "CANCELLED"
              ? normalizedCancellationReason
              : undefined,
          itemDeliveryDecisions:
            normalizedStatus === "COMPLETED"
              ? itemDeliveryDecisions
              : undefined,
        },
        tx
      ),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    }
  );

  if (normalizedStatus === "COMPLETED") {
    await syncAppointmentFinancialSnapshots(appointmentId, db);
  }

  return updatedAppointment;
}

export async function updateAppointmentStatusForAdmin(
  {
    appointmentId,
    status,
    paymentMethod,
    cancellationReason,
    itemDeliveryDecisions,
  }: {
    appointmentId: string;
    status: string;
    paymentMethod?: string | null;
    cancellationReason?: string | null;
    itemDeliveryDecisions?: AppointmentItemDeliveryDecision[];
  },
  db: AppointmentPrismaClient = prisma
) {
  const normalizedStatus = normalizeAppointmentStatus(status) as AppointmentStatus;
  const normalizedPaymentMethod =
    normalizedStatus === "COMPLETED"
      ? normalizePaymentMethod(paymentMethod)
      : null;

  if (!appointmentId || !APPOINTMENT_STATUSES.includes(normalizedStatus)) {
    throw new AppointmentMutationError("Status de agendamento invalido.");
  }

  if (normalizedStatus === "COMPLETED" && !normalizedPaymentMethod) {
    throw new AppointmentMutationError(
      "Escolha Pix, dinheiro ou cartao antes de concluir."
    );
  }

  const updatedAppointment = await db.$transaction(
    (tx) =>
      updateAppointmentStatusWithSideEffects(
        {
          appointmentId,
          nextStatus: normalizedStatus,
          paymentMethod: normalizedPaymentMethod,
          allowCompletedStatusChange: true,
          cancellationReason:
            normalizedStatus === "CANCELLED"
              ? cancellationReason?.trim() || "Cancelado pelo admin."
              : undefined,
          itemDeliveryDecisions:
            normalizedStatus === "COMPLETED"
              ? itemDeliveryDecisions
              : undefined,
        },
        tx
      ),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    }
  );

  if (normalizedStatus === "COMPLETED") {
    await syncAppointmentFinancialSnapshots(appointmentId, db);
  }

  return updatedAppointment;
}

export async function cancelAppointmentByCustomer(
  {
    appointmentId,
    customerId,
  }: {
    appointmentId: string;
    customerId: string;
  },
  db: AppointmentPrismaClient = prisma
) {
  return db.$transaction(
    async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          id: true,
          customerId: true,
          isManualFitIn: true,
          status: true,
          date: true,
        },
      });

      if (
        !appointment ||
        appointment.customerId !== customerId ||
        appointment.isManualFitIn
      ) {
        throw new AppointmentMutationError("Agendamento nao encontrado para sua conta.");
      }

      if (["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"].includes(appointment.status)) {
        throw new AppointmentMutationError("Esse agendamento nao pode mais ser cancelado.");
      }

      if (isScheduleDateTimePast(appointment.date)) {
        throw new AppointmentMutationError(
          "Esse horario ja passou. Fale com o barbeiro para ajustar o status."
        );
      }

      await updateAppointmentStatusWithSideEffects(
        {
          appointmentId,
          nextStatus: "CANCELLED",
          cancellationReason: "Cancelado pelo cliente.",
        },
        tx
      );
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    }
  );
}

export async function setAppointmentItemDeliveryStatus(
  {
    appointmentItemId,
    barberId,
    isDelivered,
    isAdmin = false,
  }: {
    appointmentItemId: string;
    barberId?: string;
    isDelivered: boolean;
    isAdmin?: boolean;
  },
  db: AppointmentPrismaClient = prisma
) {
  return db.$transaction(async (tx) => {
    const item = await tx.appointmentItem.findUnique({
      where: { id: appointmentItemId },
      include: {
        appointment: true,
      },
    });

    if (!item) {
      throw new AppointmentMutationError("Extra do agendamento não encontrado.");
    }

    if (!isAdmin && item.appointment.barberId !== barberId) {
      throw new AppointmentMutationError("Agendamento não encontrado para este barbeiro.");
    }

    const appointmentStatus = normalizeAppointmentStatus(item.appointment.status);

    if (FINAL_APPOINTMENT_STATUSES.includes(appointmentStatus)) {
      throw new AppointmentMutationError(
        "Esse atendimento já foi finalizado e não permite alterar extras."
      );
    }

    if (appointmentStatus !== "CONFIRMED") {
      throw new AppointmentMutationError(
        "Confirme o agendamento antes de conferir os extras."
      );
    }

    await tx.appointmentItem.update({
      where: {
        id: item.id,
      },
      data: {
        isDelivered,
        deliveredAt: new Date(),
      },
    });

    return {
      delivered: isDelivered,
      productName: item.productNameSnapshot,
    };
  });
}

async function updateAppointmentStatusWithSideEffects(
  {
    appointmentId,
    nextStatus,
    paymentMethod,
    cancellationReason,
    itemDeliveryDecisions,
    allowCompletedStatusChange = false,
  }: {
    appointmentId: string;
    nextStatus: AppointmentStatus;
    paymentMethod?: AppointmentPaymentMethod | null;
    cancellationReason?: string;
    itemDeliveryDecisions?: AppointmentItemDeliveryDecision[];
    allowCompletedStatusChange?: boolean;
  },
  db: AppointmentTransactionClient
) {
  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      items: true,
    },
  });

  if (!appointment) {
    throw new AppointmentMutationError("Agendamento não encontrado.");
  }

  const currentStatus = normalizeAppointmentStatus(appointment.status);

  if (currentStatus === nextStatus) {
    return appointment;
  }

  const isLeavingCompleted = currentStatus === "COMPLETED";
  const isLeavingReleasedFinalStatus =
    currentStatus === "CANCELLED" || currentStatus === "NO_SHOW";
  const isLeavingFinalStatus = FINAL_APPOINTMENT_STATUSES.includes(currentStatus);
  const canLeaveFinalStatus = allowCompletedStatusChange && isLeavingFinalStatus;

  if (isLeavingFinalStatus && !canLeaveFinalStatus) {
    throw new AppointmentMutationError("Esse atendimento já foi finalizado.");
  }

  let appointmentItems = appointment.items;

  if (nextStatus === "COMPLETED" && itemDeliveryDecisions?.length) {
    const itemIds = new Set(appointment.items.map((item) => item.id));
    const deliveryDecisionByItemId = new Map<string, boolean>();

    for (const decision of itemDeliveryDecisions) {
      if (!itemIds.has(decision.appointmentItemId)) {
        throw new AppointmentMutationError("Retirada inválida para esse atendimento.");
      }

      deliveryDecisionByItemId.set(
        decision.appointmentItemId,
        decision.isDelivered
      );
    }

    const reviewedAt = new Date();
    await Promise.all(
      appointment.items.map((item) => {
        if (!deliveryDecisionByItemId.has(item.id)) {
          return null;
        }

        return db.appointmentItem.update({
          where: {
            id: item.id,
          },
          data: {
            isDelivered: deliveryDecisionByItemId.get(item.id) || false,
            deliveredAt: reviewedAt,
          },
        });
      })
    );

    appointmentItems = appointment.items.map((item) => {
      if (!deliveryDecisionByItemId.has(item.id)) {
        return item;
      }

      return {
        ...item,
        isDelivered: deliveryDecisionByItemId.get(item.id) || false,
        deliveredAt: reviewedAt,
      };
    });
  }

  if (
    nextStatus === "COMPLETED" &&
    appointmentItems.some((item) => item.deliveredAt === null)
  ) {
    throw new AppointmentMutationError(
      "Marque cada retirada como entregue ou não entregue antes de concluir."
    );
  }

  if (nextStatus === "COMPLETED") {
    if (!paymentMethod) {
      throw new AppointmentMutationError(
        "Informe a forma de pagamento para concluir o atendimento."
      );
    }
  }

  if (nextStatus === "COMPLETED" || isLeavingCompleted) {
    await assertNoLockedPayoutForAppointmentPeriod(db, {
      shopId: appointment.shopId,
      barberId: appointment.barberId,
      date: appointment.date,
    });
  }

  const reopeningFinalToActive =
    isLeavingFinalStatus && ["PENDING", "CONFIRMED"].includes(nextStatus);
  const closingCompletedAsCancelledOrNoShow =
    isLeavingCompleted && ["CANCELLED", "NO_SHOW"].includes(nextStatus);
  const completingReleasedFinalStatus =
    isLeavingReleasedFinalStatus && nextStatus === "COMPLETED";

  if (reopeningFinalToActive || completingReleasedFinalStatus) {
    const itemsToReserveAgain = isLeavingCompleted
      ? appointmentItems.filter((item) => item.deliveredAt !== null && !item.isDelivered)
      : completingReleasedFinalStatus
      ? appointmentItems.filter((item) => item.isDelivered)
      : appointmentItems;

    for (const item of itemsToReserveAgain) {
      const updated = await db.extraProduct.updateMany({
        where: {
          id: item.extraProductId,
          stock: {
            gte: item.quantity,
          },
        },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });

      if (updated.count === 0) {
        throw new AppointmentMutationError(
          `${item.productNameSnapshot} nao possui estoque suficiente para reabrir esse atendimento.`
        );
      }

      await registerExtraStockMovement(
        {
          extraProductId: item.extraProductId,
          shopId: appointment.shopId,
          type: reopeningFinalToActive
            ? "ADMIN_REOPEN_RESERVE_OUT"
            : "FINANCE_EDIT_RESERVE_OUT",
          quantity: item.quantity,
          reason: reopeningFinalToActive
            ? `Reabertura pelo admin do atendimento ${appointment.id}`
            : `Conclusao pelo admin do atendimento ${appointment.id}`,
        },
        db
      );
    }
  }

  const shouldReturnExtras =
    !isLeavingCompleted &&
    !isLeavingReleasedFinalStatus &&
    (nextStatus === "CANCELLED" ||
      nextStatus === "NO_SHOW" ||
      nextStatus === "COMPLETED");
  const returnedItems = closingCompletedAsCancelledOrNoShow
    ? appointmentItems.filter((item) => item.deliveredAt !== null && item.isDelivered)
    : nextStatus === "COMPLETED" && !isLeavingReleasedFinalStatus
    ? appointmentItems.filter((item) => !item.isDelivered)
    : shouldReturnExtras
    ? appointmentItems
    : [];

  if (returnedItems.length > 0) {
    for (const item of returnedItems) {
      await db.extraProduct.update({
        where: {
          id: item.extraProductId,
        },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      });

      await registerExtraStockMovement(
        {
          extraProductId: item.extraProductId,
          shopId: appointment.shopId,
          type:
            nextStatus === "COMPLETED"
              ? "UNDELIVERED_RETURN"
              : nextStatus === "NO_SHOW"
              ? "NO_SHOW_RETURN"
              : "CANCEL_RETURN",
          quantity: item.quantity,
          reason:
            nextStatus === "COMPLETED"
              ? `Devolução de extra não entregue no agendamento ${appointment.id}`
              : `Devolução por ${nextStatus === "NO_SHOW" ? "não comparecimento" : "cancelamento"} do agendamento ${appointment.id}`,
        },
        db
      );
    }
  }

  if (
    nextStatus === "CANCELLED" ||
    nextStatus === "NO_SHOW" ||
    reopeningFinalToActive
  ) {
    await db.appointmentItem.updateMany({
      where: {
        appointmentId,
      },
      data: {
        isDelivered: false,
        deliveredAt: null,
      },
    });
  }

  return db.appointment.update({
    where: { id: appointmentId },
    data: {
      status: nextStatus,
      paymentMethod:
        nextStatus === "COMPLETED" ? paymentMethod : null,
      notes:
        nextStatus === "CANCELLED" && cancellationReason
          ? [appointment.notes, cancellationReason].filter(Boolean).join(" | ")
          : appointment.notes,
    },
  });
}
