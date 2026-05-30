import {
  createScheduleDate,
  getScheduleDateValue,
  getScheduleDayOfWeek,
  getScheduleDayRange,
  formatScheduleTime,
} from "@/lib/scheduleTime";

export type AgendaBlockItem = {
  id: string;
  sourceId: string;
  barberId: string;
  barberName?: string | null;
  date: string;
  startDateTime: Date;
  endDateTime: Date;
  startTime: string;
  endTime: string;
  reason: string;
  kind: "single" | "recurring";
};

type BarberBlockSource = {
  id: string;
  barberId: string;
  startDateTime: Date;
  endDateTime: Date;
  reason: string | null;
  barber?: {
    name: string | null;
  };
};

type RecurringBarberBlockSource = {
  id: string;
  barberId: string;
  weekDay: number;
  startTime: string;
  endTime: string;
  reason: string | null;
  barber?: {
    name: string | null;
  };
};

function addDays(dateValue: string, days: number) {
  const range = getScheduleDayRange(dateValue);

  if (!range) {
    return dateValue;
  }

  const next = new Date(range.start);
  next.setUTCDate(next.getUTCDate() + days);

  return getScheduleDateValue(next);
}

export function enumerateScheduleDates(dateFrom: string, dateTo: string) {
  const fromRange = getScheduleDayRange(dateFrom);
  const toRange = getScheduleDayRange(dateTo);

  if (!fromRange || !toRange) {
    return [];
  }

  const startValue = dateFrom <= dateTo ? dateFrom : dateTo;
  const endValue = dateFrom <= dateTo ? dateTo : dateFrom;
  const dates: string[] = [];
  let current = startValue;

  while (current <= endValue) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}

export function buildAgendaBlockItems({
  dateFrom,
  dateTo,
  blocks,
  recurringBlocks,
}: {
  dateFrom: string;
  dateTo: string;
  blocks: BarberBlockSource[];
  recurringBlocks: RecurringBarberBlockSource[];
}) {
  const dateValues = enumerateScheduleDates(dateFrom, dateTo);
  const oneOffBlockItems = blocks
    .map((block): AgendaBlockItem | null => {
      const date = getScheduleDateValue(new Date(block.startDateTime));

      if (!dateValues.includes(date)) {
        return null;
      }

      return {
        id: `block:${block.id}`,
        sourceId: block.id,
        barberId: block.barberId,
        barberName: block.barber?.name || null,
        date,
        startDateTime: new Date(block.startDateTime),
        endDateTime: new Date(block.endDateTime),
        startTime: formatScheduleTime(new Date(block.startDateTime)),
        endTime: formatScheduleTime(new Date(block.endDateTime)),
        reason: block.reason?.trim() || "Bloqueio",
        kind: "single",
      };
    })
    .filter((block): block is AgendaBlockItem => Boolean(block));

  const recurringBlockItems = dateValues.flatMap((date) => {
    const weekDay = getScheduleDayOfWeek(date);

    if (weekDay === null) {
      return [];
    }

    return recurringBlocks
      .filter((block) => block.weekDay === weekDay)
      .map((block): AgendaBlockItem | null => {
        const startDateTime = createScheduleDate(date, block.startTime);
        const endDateTime = createScheduleDate(date, block.endTime);

        if (!startDateTime || !endDateTime) {
          return null;
        }

        return {
          id: `recurring-block:${block.id}:${date}`,
          sourceId: block.id,
          barberId: block.barberId,
          barberName: block.barber?.name || null,
          date,
          startDateTime,
          endDateTime,
          startTime: block.startTime,
          endTime: block.endTime,
          reason: block.reason?.trim() || "Bloqueio",
          kind: "recurring",
        };
      })
      .filter((block): block is AgendaBlockItem => Boolean(block));
  });

  return [...oneOffBlockItems, ...recurringBlockItems].sort(
    (left, right) => left.startDateTime.getTime() - right.startDateTime.getTime()
  );
}
