export const SCHEDULE_TIME_ZONE = "America/Sao_Paulo";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type TimeParts = {
  hours: number;
  minutes: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateParts(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function parseTimeParts(value: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(valueByType.get("year")),
    month: Number(valueByType.get("month")),
    day: Number(valueByType.get("day")),
    hours: Number(valueByType.get("hour")),
    minutes: Number(valueByType.get("minute")),
  };
}

export function createScheduleDate(date: string, time: string) {
  const dateParts = parseDateParts(date);
  const timeParts = parseTimeParts(time);

  if (!dateParts || !timeParts) {
    return null;
  }

  return new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      timeParts.hours,
      timeParts.minutes,
      0,
      0
    )
  );
}

export function createScheduleDateTimeInput(value: string) {
  const [date = "", time = ""] = value.split("T");
  return createScheduleDate(date, time.slice(0, 5));
}

export function createScheduleDayStart(date: string) {
  return createScheduleDate(date, "00:00");
}

export function createScheduleDayEnd(date: string) {
  const start = createScheduleDayStart(date);

  if (!start) {
    return null;
  }

  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function getScheduleDayRange(date: string) {
  const start = createScheduleDayStart(date);
  const end = createScheduleDayEnd(date);

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

export function getScheduleDateValue(date: Date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("-");
}

export function getCurrentScheduleDateValue(now = new Date()) {
  const parts = getZonedParts(now);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getCurrentScheduleDate(now = new Date()) {
  const parts = getZonedParts(now);
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes, 0, 0)
  );
}

export function getCurrentScheduleMinutes(now = new Date()) {
  const parts = getZonedParts(now);
  return parts.hours * 60 + parts.minutes;
}

export function getScheduleDayOfWeek(date: string) {
  const dayStart = createScheduleDayStart(date);
  return dayStart ? dayStart.getUTCDay() : null;
}

export function getScheduleMinutes(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function isScheduleDateTimePast(date: Date, now = new Date()) {
  return date.getTime() <= getCurrentScheduleDate(now).getTime();
}

export function formatScheduleDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {}
) {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    ...options,
  });
}

export function formatScheduleTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  });
}
