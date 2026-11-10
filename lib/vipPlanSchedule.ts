import { getScheduleDayOfWeek } from "@/lib/scheduleTime";

const LIMITED_DAY_PLAN_CODES = new Set([
  "CORTE_SOBRANCELHA",
  "CORTE_SOBRANCELHA_WEEKDAYS",
  "CORTE_BARBA_SOBRANCELHA",
  "CORTE_BARBA_SOBRANCELHA_WEEKDAYS",
]);

export const VIP_PLAN_AVAILABILITY_MESSAGE =
  "Este plano pode ser usado de terça a quinta e no primeiro período de sexta-feira.";

export function isVipPlanRestrictedToWeekdays(code: string) {
  return LIMITED_DAY_PLAN_CODES.has(code);
}

export function isVipPlanAvailableOnDate(code: string, date: string) {
  if (!isVipPlanRestrictedToWeekdays(code)) {
    return true;
  }

  const dayOfWeek = getScheduleDayOfWeek(date);
  return dayOfWeek !== null && dayOfWeek >= 2 && dayOfWeek <= 5;
}

export function isVipPlanAvailableAt(code: string, date: string, time: string) {
  if (!isVipPlanAvailableOnDate(code, date)) {
    return false;
  }

  if (!isVipPlanRestrictedToWeekdays(code)) {
    return true;
  }

  const dayOfWeek = getScheduleDayOfWeek(date);
  return dayOfWeek !== 5 || /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && Number(time.slice(0, 2)) < 12;
}
