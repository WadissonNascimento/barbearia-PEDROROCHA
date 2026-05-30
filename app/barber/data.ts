import { prisma } from "@/lib/prisma";
import { getAppointmentOccupiedDuration } from "@/lib/barberSchedule";
import {
  getAppointmentDisplayName,
  getAppointmentGrandTotal,
  getAppointmentServiceRevenue,
  getAppointmentServiceMetaLine,
  getAppointmentTotalBarberPayout,
} from "@/lib/appointmentServices";
import { normalizeAppointmentStatus } from "@/lib/appointmentStatus";
import {
  appointmentForBarberSelect,
  appointmentForTotalsSelect,
} from "@/lib/appointmentSelects";
import { getBarberTipsTotal } from "@/lib/barberTips";
import {
  getManualFitInCustomerDisplay,
  getManualFitInVisibleNotes,
} from "@/lib/manualFitIn";
import {
  createScheduleDayStart,
  getCurrentScheduleDate,
  getCurrentScheduleDateValue,
  getScheduleDateValue,
  getScheduleDayRange,
} from "@/lib/scheduleTime";
import { toMoneyNumber, type MoneyValue } from "@/lib/money";
import { buildAgendaBlockItems } from "@/lib/agendaBlocks";

export type BarberDashboardFilters = {
  view?: "day" | "today" | "upcoming" | "all";
  status?: string;
  date?: string;
};

function normalizeDashboardView(
  view?: BarberDashboardFilters["view"]
): "day" | "upcoming" | "all" {
  if (view === "upcoming" || view === "all") {
    return view;
  }

  return "day";
}

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.toLowerCase());
}

function getDayRange(date: string) {
  return getScheduleDayRange(date) || getScheduleDayRange(getCurrentScheduleDateValue())!;
}

function getSelectedDate(filters: BarberDashboardFilters) {
  if (filters.date) {
    const parsed = createScheduleDayStart(filters.date);
    if (parsed) {
      return parsed;
    }
  }

  return createScheduleDayStart(getCurrentScheduleDateValue())!;
}

function getAppointmentCardItems(
  items: Array<{
    id: string;
    extraProductId: string;
    productNameSnapshot: string;
    quantity: number;
    isDelivered: boolean;
    deliveredAt: Date | null;
  }>
) {
  return items.map((item) => ({
    id: item.id,
    extraProductId: item.extraProductId,
    productNameSnapshot: item.productNameSnapshot,
    quantity: item.quantity,
    isDelivered: item.isDelivered,
    deliveredAt: item.deliveredAt,
  }));
}

function serializeServicesForClient<
  T extends {
    price: MoneyValue;
    commissionValue?: MoneyValue;
  }
>(services: T[]) {
  return services.map((service) => ({
    ...service,
    price: toMoneyNumber(service.price),
    ...(service.commissionValue === undefined
      ? {}
      : { commissionValue: toMoneyNumber(service.commissionValue) }),
  }));
}

function buildShopClientsDirectory(
  clientNotes: Array<{
    customerId: string;
    note: string;
  }>,
  customers: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    createdAt: Date;
    customerAppointments: Array<{
      date: Date;
    }>;
  }>
) {
  const noteMap = new Map(
    clientNotes.map((note) => [note.customerId, note.note] as const)
  );

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name || "Cliente",
    email: customer.email || null,
    phone: customer.phone || null,
    lastAppointment: customer.customerAppointments[0]?.date || customer.createdAt,
    totalAppointments: customer.customerAppointments.length,
    note: noteMap.get(customer.id) || "",
  }));
}

function getAppointmentCustomerForBarberCard(appointment: {
  isManualFitIn: boolean;
  notes: string | null;
  customer: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  };
}) {
  if (!appointment.isManualFitIn) {
    return {
      id: appointment.customer.id,
      name: appointment.customer.name || "Cliente",
      phone: appointment.customer.phone || null,
      email: appointment.customer.email || null,
    };
  }

  const snapshot = getManualFitInCustomerDisplay({
    notes: appointment.notes,
    fallbackCustomer: appointment.customer,
  });

  return {
    id: appointment.customer.id,
    name: snapshot.name,
    phone: snapshot.phone || null,
    email: snapshot.email,
  };
}

export async function getBarberDashboardData(
  barberId: string,
  filters: BarberDashboardFilters
) {
  const view = normalizeDashboardView(filters.view);
  const selectedDate = getSelectedDate(filters);
  const currentScheduleDate = getCurrentScheduleDate();
  const { start: selectedStart, end: selectedEnd } = getDayRange(
    getScheduleDateValue(selectedDate)
  );
  const { start: todayStart, end: todayEnd } = getDayRange(
    getCurrentScheduleDateValue()
  );
  const rawStatus = filters.status || "ACTIVE";
  const status = rawStatus === "ACTIVE" ? "ACTIVE" : normalizeAppointmentStatus(rawStatus);
  const barber = await prisma.user.findUnique({
    where: {
      id: barberId,
    },
    select: {
      shopId: true,
    },
  });
  const shopId = barber?.shopId;

  const appointmentWhere =
    view === "all"
      ? {
          barberId,
        }
      : view === "upcoming"
      ? {
          barberId,
          date: {
            gte: currentScheduleDate,
          },
        }
      : {
          barberId,
          date: {
            gte: selectedStart,
            lte: selectedEnd,
          },
        };

  const appointments = await prisma.appointment.findMany({
    where: {
      ...appointmentWhere,
      ...(status === "ACTIVE"
        ? { status: { notIn: ["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"] } }
        : status !== "ALL"
        ? { status }
        : {}),
    },
    select: appointmentForBarberSelect,
    orderBy: {
      date: "asc",
    },
  });

  const [
    todayAppointments,
    upcomingAppointments,
    services,
    availabilities,
    blocks,
    recurringBlocks,
    clientNotes,
    shopCustomers,
    walkInServices,
    walkInExtras,
    todayTips,
  ] =
    await Promise.all([
      prisma.appointment.findMany({
        where: {
          barberId,
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: {
            notIn: ["CANCELLED"],
          },
        },
        select: appointmentForBarberSelect,
        orderBy: {
          date: "asc",
        },
      }),
      prisma.appointment.findMany({
        where: {
          barberId,
          date: {
            gte: currentScheduleDate,
          },
          status: {
            notIn: ["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"],
          },
        },
        select: appointmentForBarberSelect,
        orderBy: {
          date: "asc",
        },
        take: 3,
      }),
      prisma.service.findMany({
        where: {
          barberId,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.barberAvailability.findMany({
        where: { barberId },
        orderBy: {
          weekDay: "asc",
        },
      }),
      prisma.barberBlock.findMany({
        where: {
          barberId,
          endDateTime: {
            gte: currentScheduleDate,
          },
        },
        orderBy: {
          startDateTime: "asc",
        },
      }),
      prisma.recurringBarberBlock.findMany({
        where: {
          barberId,
        },
        orderBy: [
          {
            weekDay: "asc",
          },
          {
            startTime: "asc",
          },
        ],
      }),
      prisma.clientNote.findMany({
        where: { barberId },
        select: {
          customerId: true,
          note: true,
        },
      }),
      prisma.user.findMany({
        where: {
          shopId: shopId || "__missing_shop__",
          role: "CUSTOMER",
          isActive: true,
          email: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          customerAppointments: {
            where: {
              barberId,
              isManualFitIn: false,
            },
            select: {
              date: true,
            },
            orderBy: {
              date: "desc",
            },
          },
        },
        orderBy: [
          {
            name: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      }),
      prisma.service.findMany({
        where: {
          ...(shopId ? { shopId } : {}),
          OR: [{ barberId }, { barberId: null }],
          isActive: true,
        },
        orderBy: [
          {
            barberId: "desc",
          },
          {
            name: "asc",
          },
        ],
      }),
      prisma.extraProduct.findMany({
        where: {
          ...(shopId ? { shopId } : {}),
          isActive: true,
          stock: {
            gt: 0,
          },
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
        },
      }),
      getBarberTipsTotal({
        barberId,
        range: {
          start: todayStart,
          end: todayEnd,
        },
      }),
    ]);

  const normalizedTodayAppointments = todayAppointments.map((appointment) => ({
    ...appointment,
    status: normalizeAppointmentStatus(appointment.status),
  }));
  const activeTodayAppointments = normalizedTodayAppointments.filter(
    (appointment) =>
      !["CANCELLED", "NO_SHOW"].includes(appointment.status)
  );
  const completedTodayAppointments = normalizedTodayAppointments.filter(
    (appointment) => appointment.status === "COMPLETED"
  );
  const appointmentsToday = normalizedTodayAppointments.length;
  const completedToday = completedTodayAppointments.length;
  const todayServiceMap = new Map<string, number>();

  for (const appointment of activeTodayAppointments) {
    const serviceName = getAppointmentDisplayName(appointment.services);
    todayServiceMap.set(serviceName, (todayServiceMap.get(serviceName) || 0) + 1);
  }

  const todayServices = Array.from(todayServiceMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    filters: {
      view,
      status,
      date: view === "day" ? getScheduleDateValue(selectedDate) : "",
    },
    summary: {
      appointmentsToday,
      completedToday,
      clientsToday: new Set(activeTodayAppointments.map((appointment) => appointment.customerId)).size,
      scheduledRevenueToday: activeTodayAppointments.reduce(
        (sum, appointment) => sum + getAppointmentGrandTotal(appointment.services, appointment.items),
        0
      ),
      completedRevenueToday: completedTodayAppointments.reduce(
        (sum, appointment) =>
          sum +
          getAppointmentGrandTotal(
            appointment.services,
            appointment.items.filter((item) => item.isDelivered)
          ),
        0
      ),
      barberPayoutToday: completedTodayAppointments.reduce(
        (sum, appointment) =>
          sum + getAppointmentTotalBarberPayout(appointment.services, appointment.items),
        0
      ) + todayTips.tipsTotal,
      todayServices,
      todayAppointments: normalizedTodayAppointments.map((appointment) => ({
        id: appointment.id,
        publicId: appointment.publicId,
        date: appointment.date,
        status: appointment.status,
        paymentMethod: appointment.paymentMethod,
        isManualFitIn: appointment.isManualFitIn,
        notes: appointment.isManualFitIn
          ? getManualFitInVisibleNotes(appointment.notes) || null
          : appointment.notes,
        customer: getAppointmentCustomerForBarberCard(appointment),
        serviceName: getAppointmentDisplayName(appointment.services),
        serviceMeta: getAppointmentServiceMetaLine(appointment.services),
        services: appointment.services.map((service) => ({
          serviceId: service.serviceId,
          nameSnapshot: service.nameSnapshot,
          priceSnapshot: toMoneyNumber(service.priceSnapshot),
          durationSnapshot: service.durationSnapshot,
          orderIndex: service.orderIndex,
        })),
        items: getAppointmentCardItems(appointment.items),
        totalPrice: getAppointmentGrandTotal(appointment.services, appointment.items),
        serviceRevenue: getAppointmentServiceRevenue(appointment.services),
        occupiedDuration: getAppointmentOccupiedDuration(appointment),
      })),
      nextAppointments: upcomingAppointments.map((appointment) => ({
        id: appointment.id,
        publicId: appointment.publicId,
        date: appointment.date,
        status: normalizeAppointmentStatus(appointment.status),
        paymentMethod: appointment.paymentMethod,
        isManualFitIn: appointment.isManualFitIn,
        notes: appointment.isManualFitIn
          ? getManualFitInVisibleNotes(appointment.notes) || null
          : appointment.notes,
        customer: getAppointmentCustomerForBarberCard(appointment),
        serviceName: getAppointmentDisplayName(appointment.services),
        serviceMeta: getAppointmentServiceMetaLine(appointment.services),
        services: appointment.services.map((service) => ({
          serviceId: service.serviceId,
          nameSnapshot: service.nameSnapshot,
          priceSnapshot: toMoneyNumber(service.priceSnapshot),
          durationSnapshot: service.durationSnapshot,
          orderIndex: service.orderIndex,
        })),
        items: getAppointmentCardItems(appointment.items),
        totalPrice: getAppointmentGrandTotal(appointment.services, appointment.items),
        serviceRevenue: getAppointmentServiceRevenue(appointment.services),
        occupiedDuration: getAppointmentOccupiedDuration(appointment),
      })),
    },
    appointments: appointments.map((appointment) => ({
      ...appointment,
      status: normalizeAppointmentStatus(appointment.status),
    })),
    services: serializeServicesForClient(services),
    walkInServices: serializeServicesForClient(walkInServices),
    walkInExtras: walkInExtras.map((extra) => ({
      ...extra,
      price: toMoneyNumber(extra.price),
    })),
    availabilities,
    blocks,
    recurringBlocks,
    clients: buildShopClientsDirectory(clientNotes, shopCustomers),
  };
}

export async function getBarberAgendaData(
  barberId: string,
  filters: BarberDashboardFilters
) {
  const view = normalizeDashboardView(filters.view);
  const selectedDate = getSelectedDate(filters);
  const currentScheduleDate = getCurrentScheduleDate();
  const { start: selectedStart, end: selectedEnd } = getDayRange(
    getScheduleDateValue(selectedDate)
  );
  const rawStatus = filters.status || "ACTIVE";
  const status = rawStatus === "ACTIVE" ? "ACTIVE" : normalizeAppointmentStatus(rawStatus);

  const appointmentWhere =
    view === "all"
      ? {
          barberId,
        }
      : view === "upcoming"
      ? {
          barberId,
          date: {
            gte: currentScheduleDate,
          },
        }
      : {
          barberId,
          date: {
            gte: selectedStart,
            lte: selectedEnd,
          },
        };

  const [appointments, barber] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        ...appointmentWhere,
        ...(status === "ACTIVE"
          ? { status: { notIn: ["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"] } }
          : status !== "ALL"
          ? { status }
          : {}),
      },
      select: appointmentForBarberSelect,
      orderBy: {
        date: "asc",
      },
    }),
    prisma.user.findUnique({
      where: {
        id: barberId,
      },
      select: {
        shopId: true,
      },
    }),
  ]);
  const shopId = barber?.shopId || undefined;
  const currentServiceIds = Array.from(
    new Set(
      appointments.flatMap((appointment) =>
        appointment.services.map((service) => service.serviceId)
      )
    )
  );
  const currentExtraProductIds = Array.from(
    new Set(
      appointments.flatMap((appointment) =>
        appointment.items.map((item) => item.extraProductId)
      )
    )
  );

  const [services, extras, blocks, recurringBlocks] = await Promise.all([
    prisma.service.findMany({
      where: {
        ...(shopId ? { shopId } : {}),
        OR: [{ barberId }, { barberId: null }],
        AND: [
          {
            OR: [
              { isActive: true },
              ...(currentServiceIds.length
                ? [{ id: { in: currentServiceIds } }]
                : []),
            ],
          },
        ],
      },
      orderBy: [
        {
          barberId: "desc",
        },
        {
          name: "asc",
        },
      ],
    }),
    prisma.extraProduct.findMany({
      where: {
        ...(shopId ? { shopId } : {}),
        OR: [
          {
            isActive: true,
            stock: {
              gt: 0,
            },
          },
          ...(currentExtraProductIds.length
            ? [{ id: { in: currentExtraProductIds } }]
            : []),
        ],
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
      },
    }),
    prisma.barberBlock.findMany({
      where: {
        ...(shopId ? { shopId } : {}),
        barberId,
        startDateTime: {
          lte: selectedEnd,
        },
        endDateTime: {
          gte: selectedStart,
        },
      },
      orderBy: {
        startDateTime: "asc",
      },
    }),
    prisma.recurringBarberBlock.findMany({
      where: {
        ...(shopId ? { shopId } : {}),
        barberId,
        isActive: true,
      },
      orderBy: [
        {
          weekDay: "asc",
        },
        {
          startTime: "asc",
        },
      ],
    }),
  ]);

  return {
    appointments,
    blocks: buildAgendaBlockItems({
      dateFrom: getScheduleDateValue(selectedStart),
      dateTo: getScheduleDateValue(selectedEnd),
      blocks,
      recurringBlocks,
    }),
    services: serializeServicesForClient(services),
    extras: extras.map((extra) => ({
      ...extra,
      price: toMoneyNumber(extra.price),
    })),
    filters: {
      view,
      status,
      date: getScheduleDateValue(selectedDate),
    },
  };
}

export async function getBarberTodayDashboardData(barberId: string) {
  const { start: todayStart, end: todayEnd } = getDayRange(
    getCurrentScheduleDateValue()
  );
  const barber = await prisma.user.findUnique({
    where: {
      id: barberId,
    },
    select: {
      shopId: true,
    },
  });
  const shopId = barber?.shopId;

  const [
    todayAppointments,
    todayBlocks,
    todayRecurringBlocks,
    walkInServices,
    walkInExtras,
    clientNotes,
    shopCustomers,
    todayTips,
    appNotifications,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        barberId,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          notIn: ["CANCELLED"],
        },
      },
      select: appointmentForBarberSelect,
      orderBy: {
        date: "asc",
      },
    }),
    prisma.barberBlock.findMany({
      where: {
        barberId,
        ...(shopId ? { shopId } : {}),
        startDateTime: {
          lte: todayEnd,
        },
        endDateTime: {
          gte: todayStart,
        },
      },
      include: {
        barber: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startDateTime: "asc",
      },
    }),
    prisma.recurringBarberBlock.findMany({
      where: {
        barberId,
        ...(shopId ? { shopId } : {}),
        isActive: true,
      },
      include: {
        barber: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        {
          weekDay: "asc",
        },
        {
          startTime: "asc",
        },
      ],
    }),
    prisma.service.findMany({
      where: {
        ...(shopId ? { shopId } : {}),
        OR: [{ barberId }, { barberId: null }],
        isActive: true,
      },
      orderBy: [
        {
          barberId: "desc",
        },
        {
          name: "asc",
        },
      ],
    }),
    prisma.extraProduct.findMany({
      where: {
        ...(shopId ? { shopId } : {}),
        isActive: true,
        stock: {
          gt: 0,
        },
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
      },
    }),
    prisma.clientNote.findMany({
      where: { barberId },
      select: {
        customerId: true,
        note: true,
      },
    }),
    prisma.user.findMany({
      where: {
        shopId: shopId || "__missing_shop__",
        role: "CUSTOMER",
        isActive: true,
        email: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        customerAppointments: {
          where: {
            barberId,
            isManualFitIn: false,
          },
          select: {
            date: true,
          },
          orderBy: {
            date: "desc",
          },
        },
      },
      orderBy: [
        {
          name: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),
    getBarberTipsTotal({
      barberId,
      range: {
        start: todayStart,
        end: todayEnd,
      },
    }),
    prisma.appNotification.findMany({
      where: {
        recipientUserId: barberId,
        ...(shopId ? { shopId } : {}),
      },
      select: {
        id: true,
        type: true,
        eyebrow: true,
        title: true,
        body: true,
        actionUrl: true,
        metadata: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
  ]);

  const normalizedTodayAppointments = todayAppointments.map((appointment) => ({
    ...appointment,
    status: normalizeAppointmentStatus(appointment.status),
  }));
  const activeTodayAppointments = normalizedTodayAppointments.filter(
    (appointment) =>
      !["CANCELLED", "NO_SHOW"].includes(appointment.status)
  );
  const completedTodayAppointments = normalizedTodayAppointments.filter(
    (appointment) => appointment.status === "COMPLETED"
  );
  const appointmentsToday = normalizedTodayAppointments.length;
  const completedToday = completedTodayAppointments.length;
  const todayServiceMap = new Map<string, number>();

  for (const appointment of activeTodayAppointments) {
    const serviceName = getAppointmentDisplayName(appointment.services);
    todayServiceMap.set(serviceName, (todayServiceMap.get(serviceName) || 0) + 1);
  }

  const todayServices = Array.from(todayServiceMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const todayDateValue = getScheduleDateValue(todayStart);
  const agendaBlocksToday = buildAgendaBlockItems({
    dateFrom: todayDateValue,
    dateTo: todayDateValue,
    blocks: todayBlocks,
    recurringBlocks: todayRecurringBlocks,
  });

  return {
    summary: {
      appointmentsToday,
      completedToday,
      clientsToday: new Set(activeTodayAppointments.map((appointment) => appointment.customerId)).size,
      scheduledRevenueToday: activeTodayAppointments.reduce(
        (sum, appointment) => sum + getAppointmentGrandTotal(appointment.services, appointment.items),
        0
      ),
      completedRevenueToday: completedTodayAppointments.reduce(
        (sum, appointment) =>
          sum +
          getAppointmentGrandTotal(
            appointment.services,
            appointment.items.filter((item) => item.isDelivered)
          ),
        0
      ),
      barberPayoutToday: completedTodayAppointments.reduce(
        (sum, appointment) =>
          sum + getAppointmentTotalBarberPayout(appointment.services, appointment.items),
        0
      ) + todayTips.tipsTotal,
      todayServices,
      todayBlocks: agendaBlocksToday,
      todayAppointments: normalizedTodayAppointments.map((appointment) => ({
        id: appointment.id,
        publicId: appointment.publicId,
        date: appointment.date,
        status: appointment.status,
        paymentMethod: appointment.paymentMethod,
        isManualFitIn: appointment.isManualFitIn,
        notes: appointment.isManualFitIn
          ? getManualFitInVisibleNotes(appointment.notes) || null
          : appointment.notes,
        customer: getAppointmentCustomerForBarberCard(appointment),

        serviceName: getAppointmentDisplayName(appointment.services),
        serviceMeta: getAppointmentServiceMetaLine(appointment.services),
        services: appointment.services.map((service) => ({
          serviceId: service.serviceId,
          nameSnapshot: service.nameSnapshot,
          priceSnapshot: toMoneyNumber(service.priceSnapshot),
          durationSnapshot: service.durationSnapshot,
          orderIndex: service.orderIndex,
        })),
        items: getAppointmentCardItems(appointment.items),
        totalPrice: getAppointmentGrandTotal(appointment.services, appointment.items),
        serviceRevenue: getAppointmentServiceRevenue(appointment.services),
        occupiedDuration: getAppointmentOccupiedDuration(appointment),
      })),
      nextAppointments: [],
    },
    walkInServices: serializeServicesForClient(walkInServices),
    walkInExtras: walkInExtras.map((extra) => ({
      ...extra,
      price: toMoneyNumber(extra.price),
    })),
    clients: buildShopClientsDirectory(clientNotes, shopCustomers),
    appNotifications,
  };
}

export async function getBarberAvailabilityData(barberId: string) {
  const currentScheduleDate = getCurrentScheduleDate();
  const [availabilities, blocks, recurringBlocks] = await Promise.all([
    prisma.barberAvailability.findMany({
      where: { barberId },
      orderBy: {
        weekDay: "asc",
      },
    }),
    prisma.barberBlock.findMany({
      where: {
        barberId,
        endDateTime: {
          gte: currentScheduleDate,
        },
      },
      orderBy: {
        startDateTime: "asc",
      },
    }),
    prisma.recurringBarberBlock.findMany({
      where: {
        barberId,
      },
      orderBy: [
        {
          weekDay: "asc",
        },
        {
          startTime: "asc",
        },
      ],
    }),
  ]);

  return {
    availabilities,
    blocks,
    recurringBlocks,
  };
}

export async function getBarberClientsDirectory(barberId: string, search = "") {
  const barber = await prisma.user.findUnique({
    where: {
      id: barberId,
    },
    select: {
      shopId: true,
    },
  });

  if (!barber) {
    return {
      search: search.trim(),
      clients: [],
    };
  }

  const [clientNotes, shopCustomers] = await Promise.all([
    prisma.clientNote.findMany({
      where: { barberId },
      select: {
        customerId: true,
        note: true,
      },
    }),
    prisma.user.findMany({
      where: {
        shopId: barber.shopId,
        role: "CUSTOMER",
        isActive: true,
        email: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        customerAppointments: {
          where: {
            barberId,
            isManualFitIn: false,
          },
          select: {
            date: true,
          },
          orderBy: {
            date: "desc",
          },
        },
      },
      orderBy: [
        {
          name: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),
  ]);

  const normalizedSearch = search.trim();
  const allClients = buildShopClientsDirectory(clientNotes, shopCustomers);
  const clients = normalizedSearch
    ? allClients.filter((client) =>
        [client.name, client.email || "", client.phone || ""].some((value) =>
          matchesSearch(value, normalizedSearch)
        )
      )
    : allClients;

  return {
    search: normalizedSearch,
    clients,
  };
}

export async function getBarberClientProfile(barberId: string, customerId: string) {
  const normalizedCustomerId = customerId.trim();

  if (!normalizedCustomerId) {
    return null;
  }

  const barber = await prisma.user.findUnique({
    where: {
      id: barberId,
    },
    select: {
      shopId: true,
    },
  });

  if (!barber) {
    return null;
  }

  const customer = await prisma.user.findFirst({
    where: {
      id: normalizedCustomerId,
      shopId: barber.shopId,
      role: "CUSTOMER",
      isActive: true,
      email: {
        not: null,
      },
    },
    include: {
      customerProfile: {
        include: {
          preferredBarber: true,
        },
      },
      customerAppointments: {
          where: {
            barberId,
            isManualFitIn: false,
          },
        select: appointmentForTotalsSelect,
        orderBy: {
          date: "desc",
        },
      },
      customerClientNotes: {
        where: {
          barberId,
        },
      },
    },
  });

  if (!customer) {
    return null;
  }

  const totalAppointments = customer.customerAppointments.length;
  const completedAppointments = customer.customerAppointments.filter(
    (appointment) => normalizeAppointmentStatus(appointment.status) === "COMPLETED"
  ).length;
  const totalSpent = customer.customerAppointments.reduce(
    (sum, appointment) => sum + getAppointmentGrandTotal(appointment.services, appointment.items),
    0
  );
  const favoriteServiceMap = new Map<string, number>();

  for (const appointment of customer.customerAppointments) {
    favoriteServiceMap.set(
      getAppointmentDisplayName(appointment.services),
      (favoriteServiceMap.get(getAppointmentDisplayName(appointment.services)) || 0) + 1
    );
  }

  const favoriteService = Array.from(favoriteServiceMap.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0] || null;

  return {
    customer: {
      id: customer.id,
      name: customer.name || "Cliente",
      email: customer.email || null,
      phone: customer.phone || null,
      createdAt: customer.createdAt,
      note: customer.customerClientNotes[0]?.note || "",
      birthDate: customer.customerProfile?.birthDate || null,
      allergies: customer.customerProfile?.allergies || "",
      preferences: customer.customerProfile?.preferences || "",
      preferredBarberName: customer.customerProfile?.preferredBarber?.name || null,
    },
    stats: {
      totalAppointments,
      completedAppointments,
      totalSpent,
      favoriteService,
      lastAppointment: customer.customerAppointments[0]?.date || null,
    },
    appointments: customer.customerAppointments.map((appointment) => ({
      ...appointment,
      notes: appointment.isManualFitIn
        ? getManualFitInVisibleNotes(appointment.notes) || null
        : appointment.notes,
      status: normalizeAppointmentStatus(appointment.status),
    })),
  };
}
