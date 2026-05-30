import type { PrismaClient } from "@prisma/client";
import {
  generateSlots,
  getAppointmentOccupiedDuration,
  getAppointmentServicesOccupiedDuration,
  isActiveAppointmentStatus,
  isBlockedByRecurringBlock,
  isBlockedPeriod,
  toMinutes,
} from "@/lib/barberSchedule";
import { prisma } from "@/lib/prisma";
import {
  createScheduleDate,
  getCurrentScheduleDateValue,
  getCurrentScheduleMinutes,
  getScheduleDayOfWeek,
  getScheduleDayRange,
  getScheduleMinutes,
} from "@/lib/scheduleTime";

type BookingPrismaClient = Pick<
  PrismaClient,
  "appointment" | "barberAvailability" | "barberBlock" | "recurringBarberBlock" | "service"
>;

export class BookingAvailabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingAvailabilityError";
  }
}

export type BookingPeriodSlots = {
  morning: string[];
  afternoon: string[];
  night: string[];
};

function splitSlotsByPeriod(slots: string[]): BookingPeriodSlots {
  return {
    morning: slots.filter((slot) => toMinutes(slot) < 12 * 60),
    afternoon: slots.filter(
      (slot) => toMinutes(slot) >= 12 * 60 && toMinutes(slot) < 18 * 60
    ),
    night: slots.filter((slot) => toMinutes(slot) >= 18 * 60),
  };
}

export async function getBookingAvailability(
  {
    barberId,
    serviceIds,
    date,
    excludeAppointmentId,
    now = new Date(),
  }: {
    barberId: string;
    serviceIds: string[];
    date: string;
    excludeAppointmentId?: string | null;
    now?: Date;
  },
  db: BookingPrismaClient = prisma
) {
  if (!barberId || serviceIds.length === 0 || !date) {
    return {
      isDayAvailable: false,
      periodSlots: {
        morning: [],
        afternoon: [],
        night: [],
      } satisfies BookingPeriodSlots,
    };
  }

  const dayRange = getScheduleDayRange(date);
  const dayOfWeek = getScheduleDayOfWeek(date);

  if (!dayRange || dayOfWeek === null) {
    throw new BookingAvailabilityError("Data invalida.");
  }

  const { start: dayStart, end: dayEnd } = dayRange;

  const [services, availability, appointments, blocks, recurringBlocks] = await Promise.all([
    db.service.findMany({
      where: {
        id: {
          in: serviceIds,
        },
        OR: [{ barberId }, { barberId: null }],
        isActive: true,
      },
      select: {
        id: true,
        duration: true,
        bufferAfter: true,
      },
    }),
    db.barberAvailability.findFirst({
      where: {
        barberId,
        weekDay: dayOfWeek,
        isActive: true,
      },
      select: {
        startTime: true,
        endTime: true,
      },
    }),
    db.appointment.findMany({
      where: {
        barberId,
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      select: {
        date: true,
        status: true,
        manualDurationMinutes: true,
        services: {
          select: {
            durationSnapshot: true,
            bufferAfter: true,
          },
        },
      },
    }),
    db.barberBlock.findMany({
      where: {
        barberId,
        startDateTime: {
          lte: dayEnd,
        },
        endDateTime: {
          gte: dayStart,
        },
      },
      select: {
        startDateTime: true,
        endDateTime: true,
      },
    }),
    db.recurringBarberBlock.findMany({
      where: {
        barberId,
        weekDay: dayOfWeek,
        isActive: true,
      },
      select: {
        startTime: true,
        endTime: true,
      },
    }),
  ]);

  if (services.length !== serviceIds.length) {
    throw new BookingAvailabilityError(
      "Um ou mais servicos escolhidos nao estao disponiveis para esse barbeiro."
    );
  }

  if (!availability) {
    return {
      isDayAvailable: false,
      periodSlots: {
        morning: [],
        afternoon: [],
        night: [],
      } satisfies BookingPeriodSlots,
    };
  }

  const selectedOccupiedDuration = getAppointmentServicesOccupiedDuration(
    services.map((service) => ({
      durationSnapshot: service.duration,
      bufferAfter: service.bufferAfter,
    }))
  );

  const generatedSlots = generateSlots(availability.startTime, availability.endTime);
  const dayEndMinutes = toMinutes(availability.endTime);
  const todayString = getCurrentScheduleDateValue(now);
  const isToday = date === todayString;
  const nowMinutes = getCurrentScheduleMinutes(now);

  const validSlots = generatedSlots.filter((slot) => {
    const candidateStart = toMinutes(slot);
    const candidateEnd = candidateStart + selectedOccupiedDuration;

    if (candidateEnd > dayEndMinutes) {
      return false;
    }

    if (isToday && candidateStart <= nowMinutes) {
      return false;
    }

    const startDate = createScheduleDate(date, slot);

    if (!startDate) {
      return false;
    }

    const endDate = new Date(startDate.getTime() + selectedOccupiedDuration * 60000);

    if (isBlockedPeriod(startDate, endDate, blocks)) {
      return false;
    }

    if (isBlockedByRecurringBlock(candidateStart, candidateEnd, recurringBlocks)) {
      return false;
    }

    const hasConflict = appointments.some((appointment) => {
      if (!isActiveAppointmentStatus(appointment.status)) {
        return false;
      }

      const appointmentDate = new Date(appointment.date);
      const existingStart = getScheduleMinutes(appointmentDate);
      const existingEnd = existingStart + getAppointmentOccupiedDuration(appointment);

      return candidateStart < existingEnd && candidateEnd > existingStart;
    });

    return !hasConflict;
  });

  return {
    isDayAvailable: true,
    periodSlots: splitSlotsByPeriod(validSlots),
  };
}
