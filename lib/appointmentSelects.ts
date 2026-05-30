import type { Prisma } from "@prisma/client";

export const appointmentCustomerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
} satisfies Prisma.UserSelect;

export const appointmentBarberSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

export const appointmentServiceSelect = {
  id: true,
  appointmentId: true,
  serviceId: true,
  orderIndex: true,
  nameSnapshot: true,
  priceSnapshot: true,
  durationSnapshot: true,
  bufferAfter: true,
  commissionTypeSnapshot: true,
  commissionValueSnapshot: true,
  barberPayoutSnapshot: true,
  shopRevenueSnapshot: true,
} satisfies Prisma.AppointmentServiceSelect;

export const appointmentItemSelect = {
  id: true,
  appointmentId: true,
  extraProductId: true,
  productNameSnapshot: true,
  quantity: true,
  unitPrice: true,
  subtotal: true,
  barberPayoutSnapshot: true,
  shopRevenueSnapshot: true,
  isDelivered: true,
  deliveredAt: true,
} satisfies Prisma.AppointmentItemSelect;

const appointmentBaseSelect = {
  id: true,
  publicId: true,
  customerId: true,
  barberId: true,
  date: true,
  status: true,
  paymentMethod: true,
  notes: true,
  isManualFitIn: true,
  manualDurationMinutes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AppointmentSelect;

export const appointmentForBarberSelect = {
  ...appointmentBaseSelect,
  customer: {
    select: appointmentCustomerSelect,
  },
  items: {
    select: appointmentItemSelect,
  },
  services: {
    select: appointmentServiceSelect,
  },
} satisfies Prisma.AppointmentSelect;

export const appointmentForAdminSelect = {
  ...appointmentBaseSelect,
  barber: {
    select: appointmentBarberSelect,
  },
  customer: {
    select: appointmentCustomerSelect,
  },
  items: {
    select: appointmentItemSelect,
  },
  services: {
    select: appointmentServiceSelect,
  },
} satisfies Prisma.AppointmentSelect;

export const appointmentForFinanceSelect = {
  ...appointmentBaseSelect,
  barber: {
    select: appointmentBarberSelect,
  },
  items: {
    select: appointmentItemSelect,
  },
  services: {
    select: appointmentServiceSelect,
  },
} satisfies Prisma.AppointmentSelect;

export const appointmentForTotalsSelect = {
  ...appointmentBaseSelect,
  items: {
    select: appointmentItemSelect,
  },
  services: {
    select: appointmentServiceSelect,
  },
} satisfies Prisma.AppointmentSelect;

export const appointmentCustomerHistorySelect = {
  ...appointmentBaseSelect,
  customer: {
    select: appointmentCustomerSelect,
  },
} satisfies Prisma.AppointmentSelect;
