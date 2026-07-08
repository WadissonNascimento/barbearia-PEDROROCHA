import { getAdminAgendaReport } from "@/lib/adminReports";
import { buildAgendaBlockItems } from "@/lib/agendaBlocks";
import { toMoneyNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import {
  getCurrentScheduleDateValue,
  getScheduleDateValue,
  getScheduleDayRange,
} from "@/lib/scheduleTime";
import {
  getManualFitInCustomerDisplay,
  getManualFitInVisibleNotes,
} from "@/lib/manualFitIn";
import {
  ACTIVE_VIP_APPOINTMENT_STATUSES_FOR_WEEKLY_LIMIT,
  isCurrentVipCyclePaymentCoveredByRecords,
} from "@/lib/vip";
import AdminAgendaClient from "./AdminAgendaClient";

const ADMIN_AGENDA_PAGE_LIMIT = 250;

type SearchParams = {
  dateFrom?: string;
  dateTo?: string;
  barberId?: string;
};

function getValidDateFilter(value: string | undefined) {
  const date = value?.trim();

  if (!date || !getScheduleDayRange(date)) {
    return "";
  }

  return date;
}

function getInitialAgendaFilters(searchParams: SearchParams) {
  const today = getCurrentScheduleDateValue();
  const dateFrom = getValidDateFilter(searchParams.dateFrom) || today;
  const dateTo = getValidDateFilter(searchParams.dateTo) || dateFrom;
  const barberId = searchParams.barberId?.trim() || "";

  if (dateFrom > dateTo) {
    return {
      dateFrom: dateTo,
      dateTo: dateFrom,
      barberId,
    };
  }

  return {
    dateFrom,
    dateTo,
    barberId,
  };
}

function getWeekStartValue(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekDay = date.getDay();
  const diffToMonday = weekDay === 0 ? -6 : 1 - weekDay;
  date.setDate(date.getDate() + diffToMonday);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default async function AdminAgendaPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const initialFilters = getInitialAgendaFilters(resolvedSearchParams);

  const fromRange = getScheduleDayRange(initialFilters.dateFrom)!;
  const toRange = getScheduleDayRange(initialFilters.dateTo)!;
  const barberFilter = initialFilters.barberId
    ? { barberId: initialFilters.barberId }
    : {};
  const shouldLoadBlocks = Boolean(initialFilters.barberId);

  const [report, barbers, services, extras, customers, blocks, recurringBlocks] =
    await Promise.all([
    getAdminAgendaReport({
      shopId,
      barberId: initialFilters.barberId || undefined,
      dateFrom: initialFilters.dateFrom,
      dateTo: initialFilters.dateTo,
    }, { limit: ADMIN_AGENDA_PAGE_LIMIT }),
    prisma.user.findMany({
      where: {
        shopId,
        role: "BARBER",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.service.findMany({
      where: {
        shopId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        duration: true,
        barberId: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
      prisma.extraProduct.findMany({
        where: {
          shopId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.user.findMany({
        where: {
          shopId,
          role: "CUSTOMER",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          vipSubscriptions: {
            where: {
              status: "ACTIVE",
            },
            include: {
              plan: true,
              payments: {
                orderBy: {
                  cycleMonth: "desc",
                },
                take: 3,
              },
              appointments: {
                where: {
                  isVipPlanUse: true,
                  status: {
                    in: ACTIVE_VIP_APPOINTMENT_STATUSES_FOR_WEEKLY_LIMIT,
                  },
                },
                select: {
                  date: true,
                },
              },
            },
            take: 1,
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
      shouldLoadBlocks
        ? prisma.barberBlock.findMany({
        where: {
          shopId,
          ...barberFilter,
          barber: {
            role: "BARBER",
            isActive: true,
          },
          startDateTime: {
            lte: toRange.end,
          },
          endDateTime: {
            gte: fromRange.start,
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
      })
        : Promise.resolve([]),
      shouldLoadBlocks
        ? prisma.recurringBarberBlock.findMany({
        where: {
          shopId,
          ...barberFilter,
          barber: {
            role: "BARBER",
            isActive: true,
          },
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
      })
        : Promise.resolve([]),
    ]);

  return (
    <AdminAgendaClient
      appointments={report.appointments.map((appointment) => {
        const manualCustomer = appointment.isManualFitIn
          ? getManualFitInCustomerDisplay({
              notes: appointment.notes,
              fallbackCustomer: appointment.customer,
            })
          : null;

        return {
          id: appointment.id,
          publicId: appointment.publicId,
          date: appointment.date,
          status: appointment.status,
          paymentMethod: appointment.paymentMethod,
          isVipPlanUse: appointment.isVipPlanUse,
          vipSubscription: appointment.vipSubscription,
          notes: appointment.isManualFitIn
            ? getManualFitInVisibleNotes(appointment.notes) || null
            : appointment.notes,
          barber: appointment.barber,
          customer: appointment.isManualFitIn
            ? {
                ...appointment.customer,
                name: manualCustomer?.name || "Cliente sem cadastro",
                phone: manualCustomer?.phone || null,
                email: manualCustomer?.email || null,
              }
            : appointment.customer,
          services: appointment.services.map((service) => ({
            serviceId: service.serviceId,
            nameSnapshot: service.nameSnapshot,
            orderIndex: service.orderIndex,
            priceSnapshot: toMoneyNumber(service.priceSnapshot),
          })),
          items: appointment.items.map((item) => ({
            extraProductId: item.extraProductId,
            productNameSnapshot: item.productNameSnapshot,
            quantity: item.quantity,
            subtotal: toMoneyNumber(item.subtotal),
          })),
        };
      })}
      blocks={buildAgendaBlockItems({
        dateFrom: initialFilters.dateFrom,
        dateTo: initialFilters.dateTo,
        blocks,
        recurringBlocks,
      })}
      barbers={barbers}
      services={services.map((service) => ({
        ...service,
        price: toMoneyNumber(service.price),
      }))}
      extras={extras.map((extra) => ({
        ...extra,
        price: toMoneyNumber(extra.price),
      }))}
      customers={customers.map((customer) => ({
        id: customer.id,
        name: customer.name || "Cliente",
        email: customer.email,
        phone: customer.phone,
        vipSubscription: customer.vipSubscriptions[0]
          ? {
              id: customer.vipSubscriptions[0].id,
              tokensRemaining: customer.vipSubscriptions[0].tokensRemaining,
              dueDay: customer.vipSubscriptions[0].dueDay,
              plan: customer.vipSubscriptions[0].plan,
              payments: customer.vipSubscriptions[0].payments,
              paymentCovered: isCurrentVipCyclePaymentCoveredByRecords(
                customer.vipSubscriptions[0].payments,
                customer.vipSubscriptions[0].dueDay
              ),
              weeklyUsedWeekStarts: customer.vipSubscriptions[0].appointments.map((appointment) =>
                getWeekStartValue(getScheduleDateValue(appointment.date))
              ),
            }
          : null,
      }))}
      initialFilters={initialFilters}
      isTruncated={report.isTruncated}
      limit={report.limit}
    />
  );
}
