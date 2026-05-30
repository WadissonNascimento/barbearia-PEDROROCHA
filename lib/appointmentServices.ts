import { formatCurrency } from "@/lib/utils";
import { toMoneyNumber, type MoneyValue } from "@/lib/money";
import {
  getAppointmentItemsBarberPayoutTotal,
  getAppointmentItemsShopRevenueTotal,
  getAppointmentItemsTotal,
} from "@/lib/appointmentItems";

export type AppointmentServiceSummary = {
  id: string;
  serviceId: string;
  name: string;
  price: number;
  duration: number;
  bufferAfter: number;
  orderIndex: number;
};

export function getAppointmentServicesSummary(
  services: Array<{
    id: string;
    orderIndex: number;
    nameSnapshot: string;
    priceSnapshot: MoneyValue;
    durationSnapshot: number;
    bufferAfter: number;
    serviceId: string;
  }>
): AppointmentServiceSummary[] {
  return [...services]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((service) => ({
      id: service.id,
      serviceId: service.serviceId,
      name: service.nameSnapshot,
      price: toMoneyNumber(service.priceSnapshot),
      duration: service.durationSnapshot,
      bufferAfter: service.bufferAfter,
      orderIndex: service.orderIndex,
    }));
}

export function getAppointmentDisplayName(
  services: Array<{
    nameSnapshot: string;
    orderIndex: number;
  }>
) {
  const sorted = [...services].sort((a, b) => a.orderIndex - b.orderIndex);
  return sorted.map((service) => service.nameSnapshot).join(" + ");
}

export function getAppointmentTotalPrice(
  services: Array<{
    priceSnapshot: MoneyValue;
  }>
) {
  return services.reduce((sum, service) => sum + toMoneyNumber(service.priceSnapshot), 0);
}

export function getAppointmentServiceRevenue(
  services: Array<{
    priceSnapshot: MoneyValue;
  }>
) {
  return getAppointmentTotalPrice(services);
}

export function getAppointmentBarberPayoutTotal(
  services: Array<{
    barberPayoutSnapshot: MoneyValue;
  }>
) {
  return services.reduce(
    (sum, service) => sum + toMoneyNumber(service.barberPayoutSnapshot),
    0
  );
}

export function getAppointmentShopRevenueTotal(
  services: Array<{
    shopRevenueSnapshot: MoneyValue;
  }>
) {
  return services.reduce(
    (sum, service) => sum + toMoneyNumber(service.shopRevenueSnapshot),
    0
  );
}

export function getAppointmentTotalBarberPayout(
  services: Array<{
    barberPayoutSnapshot: MoneyValue;
  }>,
  items: Array<{
    barberPayoutSnapshot: MoneyValue;
    isDelivered?: boolean;
  }> = []
) {
  return getAppointmentBarberPayoutTotal(services) + getAppointmentItemsBarberPayoutTotal(items);
}

export function getAppointmentTotalShopRevenue(
  services: Array<{
    shopRevenueSnapshot: MoneyValue;
  }>,
  items: Array<{
    shopRevenueSnapshot: MoneyValue;
    isDelivered?: boolean;
  }> = []
) {
  return getAppointmentShopRevenueTotal(services) + getAppointmentItemsShopRevenueTotal(items);
}

export function getAppointmentGrandTotal(
  services: Array<{
    priceSnapshot: MoneyValue;
  }>,
  items: Array<{
    subtotal: MoneyValue;
  }> = []
) {
  return getAppointmentTotalPrice(services) + getAppointmentItemsTotal(items);
}

export function getAppointmentTotalDuration(
  services: Array<{
    durationSnapshot: number;
    bufferAfter: number;
  }>
) {
  return services.reduce(
    (sum, service) => sum + service.durationSnapshot + Math.max(0, service.bufferAfter || 0),
    0
  );
}

export function getAppointmentServiceMetaLine(
  services: Array<{
    durationSnapshot: number;
    priceSnapshot: MoneyValue;
  }>
) {
  const totalDuration = services.reduce(
    (sum, service) => sum + service.durationSnapshot,
    0
  );
  const totalPrice = services.reduce(
    (sum, service) => sum + toMoneyNumber(service.priceSnapshot),
    0
  );

  return `${totalDuration} min - ${formatCurrency(totalPrice)}`;
}

