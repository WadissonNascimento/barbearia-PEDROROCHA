import { formatScheduleDate, formatScheduleTime } from "@/lib/scheduleTime";
import {
  isValidBrazilianPhone,
  maskBrazilianPhone,
  stripPhoneDigits,
} from "@/lib/phone";

function normalizeBrazilianMobileDigitsForWhatsApp(
  phone: string | null | undefined
) {
  let digits = stripPhoneDigits(phone).replace(/^0+/, "");

  if (digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const localNumber = digits.slice(2);

    if (/^[6-9]/.test(localNumber)) {
      digits = `${ddd}9${localNumber}`;
    }
  }

  const masked = maskBrazilianPhone(digits);

  return isValidBrazilianPhone(masked) ? stripPhoneDigits(masked) : null;
}

export function normalizePhoneToWhatsApp(
  phone: string | null | undefined
): string | null {
  const mobileDigits = normalizeBrazilianMobileDigitsForWhatsApp(phone);

  return mobileDigits ? `55${mobileDigits}` : null;
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message?: string
) {
  const normalizedPhone = normalizePhoneToWhatsApp(phone);

  if (!normalizedPhone) {
    return null;
  }

  const query = message ? `?text=${encodeURIComponent(message)}` : "";

  return `https://wa.me/${normalizedPhone}${query}`;
}

function formatAppointmentDate(value: Date) {
  return formatScheduleDate(new Date(value));
}

function formatAppointmentTime(value: Date) {
  return formatScheduleTime(new Date(value));
}

export function buildAppointmentContactWhatsAppUrl({
  customerName,
  barberName,
  shopName,
  serviceName,
  appointmentDate,
  customerPhone,
}: {
  customerName: string;
  barberName: string;
  shopName?: string | null;
  serviceName: string;
  appointmentDate: Date;
  customerPhone: string | null | undefined;
}) {
  const normalizedPhone = normalizePhoneToWhatsApp(customerPhone);

  if (!normalizedPhone) {
    return null;
  }

  const contactShopName = shopName?.trim() || "barbearia";
  const message =
    `Olá, ${customerName}! Aqui é o barbeiro ${barberName} da ${contactShopName}.\n\n` +
    "Estou entrando em contato sobre seu agendamento:\n\n" +
    `📅 Data: ${formatAppointmentDate(appointmentDate)}\n` +
    `⏰ Horário: ${formatAppointmentTime(appointmentDate)}\n` +
    `✂️ Serviço: ${serviceName}\n\n` +
    "Qualquer dúvida ou necessidade de ajuste, me avise por aqui.";

  return buildWhatsAppUrl(normalizedPhone, message);
}
