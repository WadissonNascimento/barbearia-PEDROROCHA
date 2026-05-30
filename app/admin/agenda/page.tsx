import { getAdminAgendaReport } from "@/lib/adminReports";
import { buildAgendaBlockItems } from "@/lib/agendaBlocks";
import { toMoneyNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import {
  getCurrentScheduleDateValue,
  getScheduleDayRange,
} from "@/lib/scheduleTime";
import {
  getManualFitInCustomerDisplay,
  getManualFitInVisibleNotes,
} from "@/lib/manualFitIn";
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

  const [report, barbers, services, extras, blocks, recurringBlocks] =
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
      initialFilters={initialFilters}
      isTruncated={report.isTruncated}
      limit={report.limit}
    />
  );
}
