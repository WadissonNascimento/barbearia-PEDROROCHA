"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  APPOINTMENT_STATUSES,
  normalizeAppointmentStatus,
} from "@/lib/appointmentStatus";
import {
  AppointmentMutationError,
  createManualFitInAppointment,
  editAppointmentForAdmin,
  editCompletedAppointmentFinancialItems,
  updateAppointmentStatusForAdmin,
} from "@/lib/appointmentMutations";
import {
  notifyCustomerAppointmentCancelled,
  notifyCustomerAppointmentCompleted,
} from "@/lib/appointmentEmails";
import { notifyBarberNoShow } from "@/lib/barberEmails";
import {
  notifyAdminsAppointmentCancelled,
  notifyAdminsAppointmentNoShow,
  notifyAdminsLowStockExtras,
} from "@/lib/appNotifications";
import {
  deleteAdminBarberBlockAction,
  deleteAdminRecurringBarberBlockAction,
  updateAdminBarberBlockAction,
  updateAdminRecurringBarberBlockAction,
} from "@/app/admin/barbeiros/actions";
import {
  BookingAvailabilityError,
  getBookingAvailability,
} from "@/lib/bookingAvailability";
import {
  getAppointmentOccupiedDuration,
  isActiveAppointmentStatus,
  minutesToTime,
  toMinutes,
} from "@/lib/barberSchedule";
import {
  isValidCustomerFullName,
  normalizeCustomerName,
} from "@/lib/customerRegistrationValidation";
import { formatManualFitInNotes } from "@/lib/manualFitIn";
import {
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { prisma } from "@/lib/prisma";
import { normalizePaymentMethod } from "@/lib/paymentMethods";
import {
  BRAZILIAN_PHONE_EXAMPLE,
  isValidBrazilianPhone,
  normalizeBrazilianPhoneForSubmit,
} from "@/lib/phone";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import {
  formatScheduleTime,
  getCurrentScheduleDateValue,
  getCurrentScheduleMinutes,
  getScheduleDayRange,
  getScheduleMinutes,
} from "@/lib/scheduleTime";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

type AdminWalkInPeriodSlots = {
  morning: string[];
  afternoon: string[];
  night: string[];
};

type AdminWalkInSlotsPayload = {
  slots: string[];
  periodSlots: AdminWalkInPeriodSlots;
};

type AdminQuickFitInPreviewPayload = {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  conflict: {
    appointmentId: string;
    publicId: number;
    customerName: string;
    startTime: string;
    endTime: string;
  } | null;
};

export async function updateAdminAgendaBlockAction(formData: FormData) {
  return updateAdminBarberBlockAction(formData);
}

export async function deleteAdminAgendaBlockAction(formData: FormData) {
  return deleteAdminBarberBlockAction(formData);
}

export async function updateAdminAgendaRecurringBlockAction(formData: FormData) {
  return updateAdminRecurringBarberBlockAction(formData);
}

export async function deleteAdminAgendaRecurringBlockAction(formData: FormData) {
  return deleteAdminRecurringBarberBlockAction(formData);
}

function flattenAvailableSlots(periodSlots: AdminWalkInPeriodSlots) {
  return [
    ...periodSlots.morning,
    ...periodSlots.afternoon,
    ...periodSlots.night,
  ];
}

function emptyAdminWalkInPeriodSlots(): AdminWalkInPeriodSlots {
  return {
    morning: [],
    afternoon: [],
    night: [],
  };
}

function adminWalkInSlotsError(
  message: string
): MutationResult<AdminWalkInSlotsPayload> {
  return {
    ...mutationError(message),
    data: {
      slots: [],
      periodSlots: emptyAdminWalkInPeriodSlots(),
    },
  } as MutationResult<AdminWalkInSlotsPayload>;
}

function normalizeQuickFitInDuration(value: unknown) {
  const duration = Number(value);

  if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
    return null;
  }

  return duration;
}

async function getAdminQuickFitInPreview({
  shopId,
  barberId,
  durationMinutes,
  now = new Date(),
}: {
  shopId: string;
  barberId: string;
  durationMinutes: number;
  now?: Date;
}): Promise<AdminQuickFitInPreviewPayload> {
  const date = getCurrentScheduleDateValue(now);
  const startMinutes = getCurrentScheduleMinutes(now);
  const endMinutes = startMinutes + durationMinutes;

  if (endMinutes > 24 * 60) {
    throw new Error("A duracao informada ultrapassa o dia de atendimento.");
  }

  const dayRange = getScheduleDayRange(date);

  if (!dayRange) {
    throw new Error("Nao foi possivel calcular o horario atual.");
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      barberId,
      date: {
        gte: dayRange.start,
        lte: dayRange.end,
      },
    },
    select: {
      id: true,
      publicId: true,
      date: true,
      status: true,
      manualDurationMinutes: true,
      customer: {
        select: {
          name: true,
        },
      },
      services: {
        select: {
          durationSnapshot: true,
          bufferAfter: true,
        },
      },
    },
  });

  const conflict = appointments.find((appointment) => {
    if (!isActiveAppointmentStatus(appointment.status)) {
      return false;
    }

    const existingStart = getScheduleMinutes(new Date(appointment.date));
    const existingEnd = existingStart + getAppointmentOccupiedDuration(appointment);

    return startMinutes < existingEnd && endMinutes > existingStart;
  });

  return {
    date,
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(endMinutes),
    durationMinutes,
    conflict: conflict
      ? {
          appointmentId: conflict.id,
          publicId: conflict.publicId,
          customerName: conflict.customer?.name || "Cliente",
          startTime: formatScheduleTime(new Date(conflict.date)),
          endTime: minutesToTime(
            getScheduleMinutes(new Date(conflict.date)) + getAppointmentOccupiedDuration(conflict)
          ),
        }
      : null,
  };
}

async function requireAdmin() {
  const { user } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return user;
}

function revalidateAgendaViews(barberId?: string | null) {
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  revalidatePath("/barber");
  revalidatePath("/barber/agenda");
  revalidatePath("/barber/financeiro");
  revalidatePath("/customer/agendamentos");
  revalidatePath("/meu-perfil");

  if (barberId) {
    revalidatePath(`/admin/barbeiros/${barberId}/repasse-hoje`);
    revalidatePath(`/admin/barbeiros/${barberId}/repasse-semana`);
  }
}

function parseSelectedExtras(formData: FormData) {
  return formData
    .getAll("extraProductIds")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((extraProductId) => ({ extraProductId, quantity: 1 }));
}

async function getOrCreateWalkInCustomer(shopId: string) {
  const existing = await prisma.user.findFirst({
    where: {
      shopId,
      role: "CUSTOMER",
      email: null,
      phone: null,
      name: "Encaixe manual",
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      shopId,
      name: "Encaixe manual",
      role: "CUSTOMER",
      isActive: true,
    },
    select: {
      id: true,
    },
  });
}

export async function getAdminWalkInAvailableSlotsAction({
  barberId,
  date,
  serviceIds,
}: {
  barberId: string;
  date: string;
  serviceIds: string[];
}): Promise<MutationResult<AdminWalkInSlotsPayload>> {
  const admin = await requireAdmin();
  const selectedBarberId = String(barberId || "").trim();
  const selectedDate = String(date || "").trim();
  const selectedServiceIds = serviceIds
    .map((serviceId) => String(serviceId || "").trim())
    .filter(Boolean);

  if (!admin.shopId) {
    return adminWalkInSlotsError("Admin sem barbearia vinculada.");
  }

  if (
    !selectedBarberId ||
    !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ||
    selectedServiceIds.length === 0 ||
    selectedServiceIds.length > 8
  ) {
    return adminWalkInSlotsError(
      "Selecione barbeiro, servicos e data para carregar os horarios."
    );
  }

  const [barber, services] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: selectedBarberId,
        shopId: admin.shopId,
        role: "BARBER",
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
    prisma.service.findMany({
      where: {
        shopId: admin.shopId,
        id: {
          in: selectedServiceIds,
        },
        OR: [{ barberId: selectedBarberId }, { barberId: null }],
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!barber) {
    return adminWalkInSlotsError("Barbeiro selecionado nao encontrado.");
  }

  if (services.length !== selectedServiceIds.length) {
    return adminWalkInSlotsError(
      "Um ou mais servicos estao indisponiveis para esse barbeiro."
    );
  }

  try {
    const availability = await getBookingAvailability({
      barberId: selectedBarberId,
      serviceIds: selectedServiceIds,
      date: selectedDate,
    });

    return mutationSuccess("Horarios carregados.", {
      slots: flattenAvailableSlots(availability.periodSlots),
      periodSlots: availability.periodSlots,
    });
  } catch (error) {
    if (error instanceof BookingAvailabilityError) {
      return adminWalkInSlotsError(error.message);
    }

    throw error;
  }
}

export async function getAdminQuickFitInPreviewAction({
  barberId,
  durationMinutes,
}: {
  barberId: string;
  durationMinutes: number;
}): Promise<MutationResult<AdminQuickFitInPreviewPayload>> {
  const admin = await requireAdmin();
  const selectedBarberId = String(barberId || "").trim();
  const normalizedDuration = normalizeQuickFitInDuration(durationMinutes);

  if (!admin.shopId) {
    return mutationError(
      "Admin sem barbearia vinculada."
    ) as MutationResult<AdminQuickFitInPreviewPayload>;
  }

  if (!selectedBarberId || !normalizedDuration) {
    return mutationError(
      "Selecione barbeiro e uma duracao entre 5 e 240 minutos."
    ) as MutationResult<AdminQuickFitInPreviewPayload>;
  }

  const barber = await prisma.user.findFirst({
    where: {
      id: selectedBarberId,
      shopId: admin.shopId,
      role: "BARBER",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!barber) {
    return mutationError(
      "Barbeiro selecionado nao encontrado."
    ) as MutationResult<AdminQuickFitInPreviewPayload>;
  }

  try {
    return mutationSuccess(
      "Previa do encaixe rapido calculada.",
      await getAdminQuickFitInPreview({
        shopId: admin.shopId,
        barberId: selectedBarberId,
        durationMinutes: normalizedDuration,
      })
    );
  } catch (error) {
    return mutationError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel calcular o encaixe rapido."
    ) as MutationResult<AdminQuickFitInPreviewPayload>;
  }
}

export async function createAdminWalkInAppointmentAction(
  formData: FormData
): Promise<MutationResult> {
  const admin = await requireAdmin();
  const barberId = String(formData.get("barberId") || "").trim();
  const customerName = normalizeCustomerName(
    String(formData.get("customerName") || "")
  );
  const rawCustomerPhone = String(formData.get("customerPhone") || "");
  const customerPhone = normalizeBrazilianPhoneForSubmit(rawCustomerPhone);
  const hasRawCustomerPhone = Boolean(rawCustomerPhone.trim());
  const serviceIds = formData
    .getAll("serviceIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const extras = parseSelectedExtras(formData);
  const fitInMode = String(formData.get("fitInMode") || "standard") === "quick"
    ? "quick"
    : "standard";
  const manualDurationMinutes = normalizeQuickFitInDuration(
    formData.get("manualDurationMinutes")
  );
  let date = String(formData.get("date") || "").trim();
  let startTime = String(formData.get("startTime") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (fitInMode === "quick") {
    if (!manualDurationMinutes) {
      return mutationError("Informe uma duracao entre 5 e 240 minutos.");
    }

    const now = new Date();
    date = getCurrentScheduleDateValue(now);
    startTime = minutesToTime(getCurrentScheduleMinutes(now));

    if (toMinutes(startTime) + manualDurationMinutes > 24 * 60) {
      return mutationError("A duracao informada ultrapassa o dia de atendimento.");
    }
  }

  if (!admin.shopId) {
    return mutationError("Admin sem barbearia vinculada.");
  }

  const rateLimit = await enforceRateLimit({
    scope: "admin:walk_in",
    identifier: admin.id,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return mutationError("Muitos encaixes em pouco tempo. Aguarde e tente novamente.");
  }

  if (
    !barberId ||
    !isValidCustomerFullName(customerName) ||
    (hasRawCustomerPhone && !isValidBrazilianPhone(rawCustomerPhone)) ||
    (hasRawCustomerPhone && !customerPhone) ||
    customerName.length > 80 ||
    serviceIds.length === 0 ||
    serviceIds.length > 8 ||
    extras.length > 12 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(startTime) ||
    notes.length > 200
  ) {
    return mutationError(
      `Preencha barbeiro, nome completo, telefone valido quando informado (${BRAZILIAN_PHONE_EXAMPLE}), servicos, data e horario.`
    );
  }

  const [barber, services] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: barberId,
        shopId: admin.shopId,
        role: "BARBER",
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
    prisma.service.findMany({
      where: {
        shopId: admin.shopId,
        id: {
          in: serviceIds,
        },
        OR: [{ barberId }, { barberId: null }],
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!barber) {
    return mutationError("Barbeiro selecionado nao encontrado.");
  }

  if (services.length !== serviceIds.length) {
    return mutationError("Um ou mais servicos estao indisponiveis para esse barbeiro.");
  }

  try {
    if (fitInMode === "standard") {
      const availability = await getBookingAvailability({
        barberId,
        serviceIds,
        date,
      });
      const availableSlots = flattenAvailableSlots(availability.periodSlots);

      if (!availableSlots.includes(startTime)) {
        return mutationError("Escolha um dos horarios disponiveis para esse encaixe.");
      }
    }
  } catch (error) {
    if (error instanceof BookingAvailabilityError) {
      return mutationError(error.message);
    }

    throw error;
  }

  const walkInCustomer = await getOrCreateWalkInCustomer(admin.shopId);

  try {
    await createManualFitInAppointment({
      customerId: walkInCustomer.id,
      barberId,
      serviceIds,
      extras,
      date,
      time: startTime,
      conflictMode: fitInMode === "quick" ? "SAME_START_ONLY" : "OVERLAP",
      manualDurationMinutes: fitInMode === "quick" ? manualDurationMinutes : null,
      notes: formatManualFitInNotes({
        customerName,
        customerPhone,
        notes:
          fitInMode === "quick" && manualDurationMinutes
            ? `Encaixe rapido (${manualDurationMinutes} min)${notes ? ` - ${notes}` : ""}`
            : notes,
      }),
    });
  } catch (error) {
    if (error instanceof AppointmentMutationError) {
      return mutationError(error.message);
    }

    throw error;
  }

  logSecurityEvent("admin_walk_in_appointment_created", {
    adminId: admin.id,
    barberId,
    serviceCount: serviceIds.length,
    extraCount: extras.length,
    date,
    time: startTime,
    fitInMode,
  });

  revalidateAgendaViews(barberId);
  return mutationSuccess(
    fitInMode === "quick"
      ? "Encaixe rapido criado na agenda do barbeiro."
      : "Encaixe criado na agenda do barbeiro."
  );
}

export async function updateAdminAppointmentStatusAction(
  formData: FormData
): Promise<MutationResult> {
  const admin = await requireAdmin();
  const appointmentId = String(formData.get("appointmentId") || "").trim();
  const status = normalizeAppointmentStatus(String(formData.get("status") || ""));
  const paymentMethod = normalizePaymentMethod(formData.get("paymentMethod"));
  const cancellationReason = String(formData.get("cancellationReason") || "").trim();

  if (!appointmentId || !APPOINTMENT_STATUSES.includes(status as never)) {
    return mutationError("Status de agendamento invalido.");
  }

  if (status === "CANCELLED" && !cancellationReason) {
    return mutationError("Informe o motivo do cancelamento.");
  }

  const currentAppointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      status: true,
      barberId: true,
    },
  });
  const previousStatus = currentAppointment
    ? normalizeAppointmentStatus(currentAppointment.status)
    : null;

  try {
    const itemDeliveryDecisions =
      status === "COMPLETED"
        ? (
            await prisma.appointmentItem.findMany({
              where: {
                appointmentId,
              },
              select: {
                id: true,
              },
            })
          ).map((item) => ({
            appointmentItemId: item.id,
            isDelivered: true,
          }))
        : [];

    await updateAppointmentStatusForAdmin({
      appointmentId,
      status,
      paymentMethod,
      cancellationReason,
      itemDeliveryDecisions,
    });
  } catch (error) {
    if (error instanceof AppointmentMutationError) {
      return mutationError(error.message);
    }

    throw error;
  }

  logSecurityEvent("admin_appointment_status_updated", {
    adminId: admin.id,
    appointmentId,
    previousStatus,
    nextStatus: status,
  });

  after(async () => {
    revalidateAgendaViews(currentAppointment?.barberId);

    if (status === "COMPLETED" && previousStatus !== "COMPLETED") {
      await notifyCustomerAppointmentCompleted(appointmentId);
      if (admin.shopId) {
        await notifyAdminsLowStockExtras({ shopId: admin.shopId });
      }
    }

    if (status === "CANCELLED" && previousStatus !== "CANCELLED") {
      await notifyCustomerAppointmentCancelled(appointmentId, cancellationReason);
      await notifyAdminsAppointmentCancelled(appointmentId, cancellationReason);
    }

    if (status === "NO_SHOW" && previousStatus !== "NO_SHOW") {
      await notifyBarberNoShow(appointmentId);
      await notifyAdminsAppointmentNoShow(appointmentId);
    }
  });

  return mutationSuccess("Agendamento atualizado pelo admin.");
}

export async function editAdminAppointmentAction(
  formData: FormData
): Promise<MutationResult> {
  const admin = await requireAdmin();
  const appointmentId = String(formData.get("appointmentId") || "").trim();
  const barberId = String(formData.get("barberId") || "").trim();
  const date = String(formData.get("date") || "").trim();
  const time = String(formData.get("time") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const serviceIds = formData
    .getAll("serviceIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const extras = parseSelectedExtras(formData);

  if (
    !appointmentId ||
    serviceIds.length === 0 ||
    serviceIds.length > 8 ||
    extras.length > 12 ||
    notes.length > 400
  ) {
    return mutationError("Selecione servicos, extras e observacoes corretamente.");
  }

  if (!admin.shopId) {
    return mutationError("Admin sem barbearia vinculada.");
  }

  const currentAppointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      shopId: admin.shopId,
    },
    select: {
      status: true,
      barberId: true,
    },
  });

  if (!currentAppointment) {
    return mutationError("Agendamento nao encontrado.");
  }

  const currentStatus = normalizeAppointmentStatus(currentAppointment.status);
  const isCompletedEdit = ["COMPLETED", "DONE"].includes(currentStatus);

  if (
    !isCompletedEdit &&
    (!barberId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(time))
  ) {
    return mutationError("Preencha barbeiro, data, horario e servicos corretamente.");
  }

  try {
    if (isCompletedEdit) {
      await editCompletedAppointmentFinancialItems({
        appointmentId,
        actor: "ADMIN",
        shopId: admin.shopId,
        serviceIds,
        extras,
        notes,
      });
    } else {
      await editAppointmentForAdmin({
        appointmentId,
        barberId,
        serviceIds,
        extras,
        date,
        time,
        notes,
      });
    }
  } catch (error) {
    if (error instanceof AppointmentMutationError) {
      return mutationError(error.message);
    }

    throw error;
  }

  logSecurityEvent("admin_appointment_edited", {
    adminId: admin.id,
    appointmentId,
    barberId,
    serviceCount: serviceIds.length,
    extraCount: extras.length,
    date,
    time,
    mode: isCompletedEdit ? "completed_finance_items" : "operational",
  });

  revalidateAgendaViews(isCompletedEdit ? currentAppointment.barberId : barberId);

  return mutationSuccess(
    isCompletedEdit
      ? "Atendimento atualizado no financeiro."
      : "Agendamento editado pelo admin."
  );
}
