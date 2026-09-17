const FIXED_BRAZIL_HOLIDAYS = new Set([
  "01-01",
  "04-21",
  "05-01",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "11-20",
  "12-25",
]);

function assertDueDay(dueDay: number) {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("Informe um dia de vencimento entre 1 e 31.");
  }
}

function parseCycleMonth(cycleMonth: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(cycleMonth);
  if (!match || Number(match[1]) < 1000) {
    throw new Error("Competência de vencimento inválida.");
  }
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}

// Gregorian Easter (Meeus/Jones/Butcher). Good Friday is observed in the
// federal holiday calendar; Carnaval and Corpus Christi are not included.
function getGoodFridayDateValue(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day - 2, 12)).toISOString().slice(0, 10);
}

export function isVipBillingBusinessDay(date: Date) {
  const dateValue = date.toISOString().slice(0, 10);
  return (
    date.getUTCDay() !== 0 &&
    !FIXED_BRAZIL_HOLIDAYS.has(dateValue.slice(5)) &&
    dateValue !== getGoodFridayDateValue(date.getUTCFullYear())
  );
}

export function getVipDueDayLabel(dueDay: number) {
  assertDueDay(dueDay);
  return dueDay === 5 ? "5º dia útil" : `dia ${dueDay}`;
}

/** Dates are date-only values at UTC noon. Saturdays count as business days. */
export function getVipDueDateForCycle(cycleMonth: string, dueDay = 5) {
  assertDueDay(dueDay);
  const { year, month } = parseCycleMonth(cycleMonth);
  if (dueDay !== 5) {
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(dueDay, lastDayOfMonth), 12));
  }

  const date = new Date(Date.UTC(year, month, 1, 12));
  let businessDays = 0;
  while (businessDays < 5) {
    if (isVipBillingBusinessDay(date)) businessDays += 1;
    if (businessDays < 5) date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

/** Apply the calendar to upcoming dates only; historical debts keep their date. */
export function resolveVipPolicyDueDate(dueDate: Date, dueDay: number, today: string) {
  assertDueDay(dueDay);
  const value = dueDate.toISOString().slice(0, 10);
  if (dueDay !== 5 || value < today) return dueDate;
  const candidate = getVipDueDateForCycle(value.slice(0, 7), dueDay);
  // Never retroactively make an upcoming invoice overdue while applying policy.
  return candidate.toISOString().slice(0, 10) < today ? dueDate : candidate;
}
