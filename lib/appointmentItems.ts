import { formatCurrency } from "@/lib/utils";
import { toMoneyNumber, type MoneyValue } from "@/lib/money";

export type AppointmentItemSummary = {
  id: string;
  extraProductId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isDelivered: boolean;
  deliveredAt: Date | null;
};

export function getAppointmentItemsSummary(
  items: Array<{
    id: string;
    extraProductId: string;
    productNameSnapshot: string;
    quantity: number;
    unitPrice: MoneyValue;
    subtotal: MoneyValue;
    isDelivered: boolean;
    deliveredAt: Date | null;
  }>
): AppointmentItemSummary[] {
  return items.map((item) => ({
    id: item.id,
    extraProductId: item.extraProductId,
    name: item.productNameSnapshot,
    quantity: item.quantity,
    unitPrice: toMoneyNumber(item.unitPrice),
    subtotal: toMoneyNumber(item.subtotal),
    isDelivered: item.isDelivered,
    deliveredAt: item.deliveredAt,
  }));
}

export function getAppointmentItemsTotal(
  items: Array<{
    subtotal: MoneyValue;
  }>
) {
  return items.reduce((sum, item) => sum + toMoneyNumber(item.subtotal), 0);
}

export function getAppointmentItemsBarberPayoutTotal(
  items: Array<{
    barberPayoutSnapshot: MoneyValue;
    isDelivered?: boolean;
  }>
) {
  return items.reduce(
    (sum, item) => sum + (item.isDelivered ? toMoneyNumber(item.barberPayoutSnapshot) : 0),
    0
  );
}

export function getAppointmentItemsShopRevenueTotal(
  items: Array<{
    shopRevenueSnapshot: MoneyValue;
    isDelivered?: boolean;
  }>
) {
  return items.reduce(
    (sum, item) => sum + (item.isDelivered ? toMoneyNumber(item.shopRevenueSnapshot) : 0),
    0
  );
}

export function getAppointmentItemsLabel(
  items: Array<{
    productNameSnapshot: string;
    quantity: number;
  }>
) {
  if (items.length === 0) {
    return "Sem extras";
  }

  return items
    .map((item) => `${item.productNameSnapshot} x${item.quantity}`)
    .join(", ");
}

export function getAppointmentItemsMetaLine(
  items: Array<{
    quantity: number;
    subtotal: MoneyValue;
  }>
) {
  if (items.length === 0) {
    return "Nenhum extra";
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = getAppointmentItemsTotal(items);

  return `${totalQuantity} item(ns) - ${formatCurrency(totalPrice)}`;
}
