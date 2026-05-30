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
  editCompletedAppointmentFinancialItems,
  editOpenAppointmentForBarber,
  setAppointmentItemDeliveryStatus,
  updateAppointmentStatusForBarber,
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
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { deleteLocalBarberPhoto, saveBarberPhoto } from "@/lib/barberPhoto";
import { getActiveBarberForSession } from "@/lib/barberAccess";
import { formatManualFitInNotes } from "@/lib/manualFitIn";
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
import { sanitizeEmailInput } from "@/lib/inputSanitization";
import { prisma } from "@/lib/prisma";
import { normalizePaymentMethod } from "@/lib/paymentMethods";
import {
  BRAZILIAN_PHONE_EXAMPLE,
  isValidBrazilianPhone,
  normalizeBrazilianPhoneForSubmit,
} from "@/lib/phone";
import {
  createScheduleDateTimeInput,
  formatScheduleTime,
  getCurrentScheduleDateValue,
  getCurrentScheduleMinutes,
  getScheduleDayRange,
  getScheduleMinutes,
} from "@/lib/scheduleTime";
import { enforceRateLimit } from "@/lib/security";
import {
  BARBER_ROLES,
  requireTenantSession,
  SHOP_ADMIN_ROLES,
} from "@/lib/tenantSession";
import { isUniqueConstraintError } from "@/lib/userIdentity";
import {
  isValidCustomerFullName,
  normalizeCustomerName,
} from "@/lib/customerRegistrationValidation";

function flattenAvailableSlots(periodSlots: {
  morning: string[];
  afternoon: string[];
  night: string[];
}) {
  return [
    ...periodSlots.morning,
    ...periodSlots.afternoon,
    ...periodSlots.night,
  ];
}

type WalkInPeriodSlots = {
  morning: string[];
  afternoon: string[];
  night: string[];
};

type WalkInSlotsPayload = {
  slots: string[];
  periodSlots: WalkInPeriodSlots;
};

type QuickFitInPreviewPayload = {
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

const emptyWalkInPeriodSlots = (): WalkInPeriodSlots => ({
  morning: [],
  afternoon: [],
  night: [],
});

function walkInSlotsError(message: string): MutationResult<WalkInSlotsPayload> {
  return {
    ...mutationError(message),
    data: {
      slots: [],
      periodSlots: emptyWalkInPeriodSlots(),
    },
  } as MutationResult<WalkInSlotsPayload>;
}

function normalizeQuickFitInDuration(value: unknown) {
  const duration = Number(value);

  if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
    return null;
  }

  return duration;
}

async function getQuickFitInPreviewForBarber({
  shopId,
  barberId,
  durationMinutes,
  now = new Date(),
}: {
  shopId: string;
  barberId: string;
  durationMinutes: number;
  now?: Date;
}): Promise<QuickFitInPreviewPayload> {
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
    const existingEnd =
      existingStart + getAppointmentOccupiedDuration(appointment);

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
            getScheduleMinutes(new Date(conflict.date)) +
              getAppointmentOccupiedDuration(conflict),
          ),
        }
      : null,
  };
}

async function requireBarber() {
  const { user } = await requireTenantSession({
    roles: [...BARBER_ROLES, ...SHOP_ADMIN_ROLES],
  });

  const barber = await getActiveBarberForSession(user);

  if (!barber) {
    throw new Error("Barbeiro inativo ou nao autorizado.");
  }

  return barber;
}

function isValidTimeRange(startTime: string, endTime: string) {
  return (
    /^\d{2}:\d{2}$/.test(startTime) &&
    /^\d{2}:\d{2}$/.test(endTime) &&
    startTime < endTime
  );
}

function revalidateBarberViews() {
  revalidatePath("/barber");
  revalidatePath("/barber/agenda");
  revalidatePath("/barber/servicos");
  revalidatePath("/barber/disponibilidade");
  revalidatePath("/barber/clientes");
  revalidatePath("/agendar");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/barbeiros");
}

function revalidateAppointmentStatusViews(barberId?: string) {
  revalidatePath("/barber");
  revalidatePath("/barber/agenda");
  revalidatePath("/barber/financeiro");
  revalidatePath("/admin/financeiro");
  revalidatePath("/customer/agendamentos");
  revalidatePath("/meu-perfil");
  revalidatePath("/admin/agenda");

  if (barberId) {
    revalidatePath(`/admin/barbeiros/${barberId}/repasse-hoje`);
    revalidatePath(`/admin/barbeiros/${barberId}/repasse-semana`);
  }
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

function parseItemDeliveryDecisions(formData: FormData) {
  return formData
    .getAll("itemDeliveryDecision")
    .map((value) => String(value))
    .map((value) => {
      const [appointmentItemId, deliveryStatus] = value.split(":");

      return {
        appointmentItemId: appointmentItemId?.trim() || "",
        isDelivered: deliveryStatus === "delivered",
      };
    })
    .filter((decision) => decision.appointmentItemId);
}

export async function updateOwnBarberPhotoAction(
  formData: FormData,
): Promise<MutationResult | MutationResult<{ image: string }>> {
  const barber = await requireBarber();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return mutationError("Escolha uma foto para enviar.");
  }

  const current = await prisma.user.findUnique({
    where: {
      id: barber.id,
    },
    select: {
      image: true,
    },
  });

  try {
    const image = await saveBarberPhoto(file);

    await prisma.user.update({
      where: {
        id: barber.id,
      },
      data: {
        image,
      },
    });

    await deleteLocalBarberPhoto(current?.image);
    revalidateBarberViews();

    return mutationSuccess("Foto atualizada com sucesso.", { image });
  } catch (error) {
    return mutationError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar a foto.",
    );
  }
}

export async function updateOwnBarberContactAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const name = normalizeCustomerName(formData.get("name")?.toString() || "");
  const email = sanitizeEmailInput(formData.get("email")?.toString() || "");
  const rawPhone = formData.get("phone")?.toString() || "";
  const phone = rawPhone.trim()
    ? normalizeBrazilianPhoneForSubmit(rawPhone)
    : "";

  const rateLimit = await enforceRateLimit({
    scope: "barber:contact",
    identifier: barber.id,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return mutationError(
      "Muitas alteracoes em pouco tempo. Aguarde e tente novamente.",
    );
  }

  if (name.length < 2 || name.length > 80) {
    return mutationError("Informe um nome valido.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return mutationError("Informe um e-mail valido.");
  }

  if (rawPhone.trim() && !isValidBrazilianPhone(phone)) {
    return mutationError(
      `Use um telefone no formato ${BRAZILIAN_PHONE_EXAMPLE}.`,
    );
  }

  const emailOwner = await prisma.user.findFirst({
    where: {
      shopId: barber.shopId,
      email,
      NOT: {
        id: barber.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (emailOwner) {
    return mutationError("Este e-mail ja esta em uso.");
  }

  try {
    await prisma.user.update({
      where: {
        id: barber.id,
      },
      data: {
        name,
        email,
        phone: phone || null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      return mutationError("Este e-mail ja esta em uso.");
    }

    throw error;
  }

  revalidateBarberViews();
  revalidatePath("/barber");
  revalidatePath("/admin/barbeiros");
  revalidatePath(`/admin/barbeiros/${barber.id}`);

  return mutationSuccess("Contato atualizado com sucesso.");
}

export async function updateAppointmentStatusAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const appointmentId = String(formData.get("appointmentId") || "");
  const status = normalizeAppointmentStatus(
    String(formData.get("status") || ""),
  );
  const cancellationReason = String(
    formData.get("cancellationReason") || "",
  ).trim();
  const paymentMethod = normalizePaymentMethod(formData.get("paymentMethod"));
  const itemDeliveryDecisions =
    status === "COMPLETED" ? parseItemDeliveryDecisions(formData) : [];

  if (!appointmentId || !APPOINTMENT_STATUSES.includes(status as never)) {
    return mutationError("Status de agendamento invalido.");
  }

  if (status === "CANCELLED" && !cancellationReason) {
    return mutationError("Informe o motivo do cancelamento.");
  }

  const currentAppointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      barberId: barber.id,
    },
    select: {
      status: true,
    },
  });
  const previousStatus = currentAppointment
    ? normalizeAppointmentStatus(currentAppointment.status)
    : null;

  try {
    await updateAppointmentStatusForBarber({
      appointmentId,
      barberId: barber.id,
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

  after(async () => {
    revalidateAppointmentStatusViews(barber.id);

    if (status === "COMPLETED" && previousStatus !== "COMPLETED") {
      await notifyCustomerAppointmentCompleted(appointmentId);
      await notifyAdminsLowStockExtras({ shopId: barber.shopId });
    }

    if (status === "NO_SHOW" && previousStatus !== "NO_SHOW") {
      await notifyBarberNoShow(appointmentId);
      await notifyAdminsAppointmentNoShow(appointmentId);
    }

    if (status === "CANCELLED" && previousStatus !== "CANCELLED") {
      await notifyCustomerAppointmentCancelled(
        appointmentId,
        cancellationReason,
      );
      await notifyAdminsAppointmentCancelled(appointmentId, cancellationReason);
    }
  });

  return mutationSuccess("Status do agendamento atualizado.");
}

export async function setAppointmentItemDeliveryStatusAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const appointmentItemId = String(
    formData.get("appointmentItemId") || "",
  ).trim();
  const isDelivered = String(formData.get("isDelivered") || "") === "true";

  if (!appointmentItemId) {
    return mutationError("Extra invalido.");
  }

  try {
    const result = await setAppointmentItemDeliveryStatus({
      appointmentItemId,
      barberId: barber.id,
      isDelivered,
    });

    revalidateBarberViews();
    revalidatePath("/customer/agendamentos");
    revalidatePath("/admin/agenda");

    return mutationSuccess(
      result.delivered
        ? `${result.productName} marcado como entregue.`
        : `${result.productName} marcado como não entregue.`,
    );
  } catch (error) {
    if (error instanceof AppointmentMutationError) {
      return mutationError(error.message);
    }

    throw error;
  }
}

export async function editOpenBarberAppointmentAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const appointmentId = String(formData.get("appointmentId") || "").trim();
  const serviceIds = formData
    .getAll("serviceIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const extras = formData
    .getAll("extraProductIds")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((extraProductId) => ({ extraProductId, quantity: 1 }));
  const notes = String(formData.get("notes") || "").trim();

  if (
    !appointmentId ||
    serviceIds.length === 0 ||
    serviceIds.length > 8 ||
    extras.length > 12 ||
    notes.length > 400
  ) {
    return mutationError(
      "Selecione servicos, extras e observacoes corretamente.",
    );
  }

  try {
    await editOpenAppointmentForBarber({
      appointmentId,
      barberId: barber.id,
      serviceIds,
      extras,
      notes,
    });

    revalidateAppointmentStatusViews(barber.id);
    return mutationSuccess("Agendamento atualizado.");
  } catch (error) {
    if (error instanceof AppointmentMutationError) {
      return mutationError(error.message);
    }

    throw error;
  }
}

export async function editCompletedBarberFinanceAppointmentAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const appointmentId = String(formData.get("appointmentId") || "").trim();
  const serviceIds = formData
    .getAll("serviceIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const extras = formData
    .getAll("extraProductIds")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((extraProductId) => ({ extraProductId, quantity: 1 }));
  const notes = String(formData.get("notes") || "").trim();

  if (
    !appointmentId ||
    serviceIds.length === 0 ||
    serviceIds.length > 8 ||
    extras.length > 12 ||
    notes.length > 400
  ) {
    return mutationError(
      "Selecione servicos, extras e observacoes corretamente.",
    );
  }

  try {
    await editCompletedAppointmentFinancialItems({
      appointmentId,
      actor: "BARBER",
      barberId: barber.id,
      serviceIds,
      extras,
      notes,
    });

    revalidateAppointmentStatusViews(barber.id);
    return mutationSuccess("Atendimento atualizado no financeiro.");
  } catch (error) {
    if (error instanceof AppointmentMutationError) {
      return mutationError(error.message);
    }

    throw error;
  }
}

export async function createWalkInAppointmentAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const customerId = String(formData.get("customerId") || "").trim();
  const customerName = normalizeCustomerName(
    String(formData.get("customerName") || ""),
  );
  const rawCustomerPhone = String(formData.get("customerPhone") || "");
  const customerPhone = normalizeBrazilianPhoneForSubmit(rawCustomerPhone);
  const hasRawCustomerPhone = Boolean(rawCustomerPhone.trim());
  const serviceIds = formData
    .getAll("serviceIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const legacyServiceId = String(formData.get("serviceId") || "").trim();
  const selectedServiceIds =
    serviceIds.length > 0 ? serviceIds : [legacyServiceId].filter(Boolean);
  const selectedExtras = formData
    .getAll("extraProductIds")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((extraProductId) => ({ extraProductId, quantity: 1 }));
  const fitInMode =
    String(formData.get("fitInMode") || "standard") === "quick"
      ? "quick"
      : "standard";
  const manualDurationMinutes = normalizeQuickFitInDuration(
    formData.get("manualDurationMinutes"),
  );
  let date = String(formData.get("date") || "").trim();
  let startTime = String(formData.get("startTime") || "").trim();
  const extraNotes = String(formData.get("notes") || "").trim();

  if (fitInMode === "quick") {
    if (!manualDurationMinutes) {
      return mutationError("Informe uma duracao entre 5 e 240 minutos.");
    }

    const now = new Date();
    date = getCurrentScheduleDateValue(now);
    startTime = minutesToTime(getCurrentScheduleMinutes(now));

    if (toMinutes(startTime) + manualDurationMinutes > 24 * 60) {
      return mutationError(
        "A duracao informada ultrapassa o dia de atendimento.",
      );
    }
  }

  const rateLimit = await enforceRateLimit({
    scope: "barber:walk_in",
    identifier: barber.id,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return mutationError(
      "Muitos encaixes em pouco tempo. Aguarde e tente novamente.",
    );
  }

  if (
    (!customerId && !isValidCustomerFullName(customerName)) ||
    (!customerId &&
      hasRawCustomerPhone &&
      !isValidBrazilianPhone(rawCustomerPhone)) ||
    (hasRawCustomerPhone && !customerPhone) ||
    customerName.length > 80 ||
    selectedServiceIds.length === 0 ||
    selectedServiceIds.length > 8 ||
    selectedExtras.length > 12 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(startTime) ||
    extraNotes.length > 200
  ) {
    return mutationError(
      "Preencha nome completo, telefone valido quando informado, servicos, data e horario corretamente.",
    );
  }

  const services = await prisma.service.findMany({
    where: {
      shopId: barber.shopId,
      id: {
        in: selectedServiceIds,
      },
      OR: [{ barberId: barber.id }, { barberId: null }],
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (services.length !== selectedServiceIds.length) {
    return mutationError(
      "Um ou mais servicos estao indisponiveis para encaixe.",
    );
  }

  try {
    if (fitInMode === "standard") {
      const availability = await getBookingAvailability({
        barberId: barber.id,
        serviceIds: selectedServiceIds,
        date,
      });
      const availableSlots = flattenAvailableSlots(availability.periodSlots);

      if (!availableSlots.includes(startTime)) {
        return mutationError(
          "Escolha um dos horarios disponiveis para esse encaixe.",
        );
      }
    }
  } catch (error) {
    if (error instanceof BookingAvailabilityError) {
      return mutationError(error.message);
    }

    throw error;
  }

  const selectedCustomer = customerId
    ? await prisma.user.findFirst({
        where: {
          id: customerId,
          shopId: barber.shopId,
          role: "CUSTOMER",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          phone: true,
        },
      })
    : null;

  if (customerId && !selectedCustomer) {
    return mutationError("Cliente selecionado nao pertence a sua base.");
  }

  const walkInCustomer = await getOrCreateWalkInCustomer(barber.shopId);
  const displayCustomerName =
    customerName || selectedCustomer?.name || "Cliente sem cadastro";
  const displayCustomerPhone = customerPhone || selectedCustomer?.phone || "";

  try {
    await createManualFitInAppointment({
      customerId: walkInCustomer.id,
      barberId: barber.id,
      serviceIds: selectedServiceIds,
      extras: selectedExtras,
      date,
      time: startTime,
      conflictMode: fitInMode === "quick" ? "SAME_START_ONLY" : "OVERLAP",
      manualDurationMinutes:
        fitInMode === "quick" ? manualDurationMinutes : null,
      notes: formatManualFitInNotes({
        customerName: displayCustomerName,
        customerPhone: displayCustomerPhone,
        notes:
          fitInMode === "quick" && manualDurationMinutes
            ? `Encaixe rapido (${manualDurationMinutes} min)${extraNotes ? ` - ${extraNotes}` : ""}`
            : extraNotes,
      }),
    });
  } catch (error) {
    if (error instanceof AppointmentMutationError) {
      return mutationError(error.message);
    }

    throw error;
  }

  revalidateBarberViews();
  return mutationSuccess(
    fitInMode === "quick"
      ? "Encaixe rapido criado com sucesso!"
      : "Encaixe criado com sucesso!",
  );
}

export async function getQuickFitInPreviewAction({
  durationMinutes,
}: {
  durationMinutes: number;
}): Promise<MutationResult<QuickFitInPreviewPayload>> {
  const barber = await requireBarber();
  const normalizedDuration = normalizeQuickFitInDuration(durationMinutes);

  if (!normalizedDuration) {
    return mutationError(
      "Informe uma duracao entre 5 e 240 minutos.",
    ) as MutationResult<QuickFitInPreviewPayload>;
  }

  try {
    return mutationSuccess(
      "Previa do encaixe rapido calculada.",
      await getQuickFitInPreviewForBarber({
        shopId: barber.shopId,
        barberId: barber.id,
        durationMinutes: normalizedDuration,
      }),
    );
  } catch (error) {
    return mutationError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel calcular o encaixe rapido.",
    ) as MutationResult<QuickFitInPreviewPayload>;
  }
}

export async function getWalkInAvailableSlotsAction({
  date,
  serviceIds,
}: {
  date: string;
  serviceIds: string[];
}): Promise<MutationResult<WalkInSlotsPayload>> {
  const barber = await requireBarber();
  const selectedDate = String(date || "").trim();
  const selectedServiceIds = serviceIds
    .map((serviceId) => String(serviceId || "").trim())
    .filter(Boolean);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ||
    selectedServiceIds.length === 0 ||
    selectedServiceIds.length > 8
  ) {
    return walkInSlotsError(
      "Selecione servicos e data para carregar os horarios.",
    );
  }

  const services = await prisma.service.findMany({
    where: {
      shopId: barber.shopId,
      id: {
        in: selectedServiceIds,
      },
      OR: [{ barberId: barber.id }, { barberId: null }],
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (services.length !== selectedServiceIds.length) {
    return walkInSlotsError(
      "Um ou mais servicos estao indisponiveis para encaixe.",
    );
  }

  try {
    const availability = await getBookingAvailability({
      barberId: barber.id,
      serviceIds: selectedServiceIds,
      date: selectedDate,
    });

    return mutationSuccess("Horarios carregados.", {
      slots: flattenAvailableSlots(availability.periodSlots),
      periodSlots: availability.periodSlots,
    });
  } catch (error) {
    if (error instanceof BookingAvailabilityError) {
      return walkInSlotsError(error.message);
    }

    throw error;
  }
}

export async function saveBarberAvailabilityAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const weekDay = Number(formData.get("weekDay") || -1);
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const isActive = String(formData.get("isActive") || "false") === "true";

  if (weekDay < 0 || weekDay > 6 || !isValidTimeRange(startTime, endTime)) {
    return mutationError("Disponibilidade invalida.");
  }

  await prisma.barberAvailability.upsert({
    where: {
      barberId_weekDay: {
        barberId: barber.id,
        weekDay,
      },
    },
    update: {
      startTime,
      endTime,
      isActive,
    },
    create: {
      barberId: barber.id,
      weekDay,
      startTime,
      endTime,
      isActive,
    },
  });

  revalidateBarberViews();
  return mutationSuccess("Disponibilidade atualizada.");
}

export async function saveWeeklyBarberAvailabilityAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();

  const entries = Array.from({ length: 7 }, (_, weekDay) => {
    const startTime = String(formData.get(`day-${weekDay}-startTime`) || "");
    const endTime = String(formData.get(`day-${weekDay}-endTime`) || "");
    const isActive =
      String(formData.get(`day-${weekDay}-isActive`) || "false") === "true";

    if (!isValidTimeRange(startTime, endTime)) {
      throw new Error(`Horario invalido para o dia ${weekDay}.`);
    }

    return {
      weekDay,
      startTime,
      endTime,
      isActive,
    };
  });

  try {
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.barberAvailability.upsert({
          where: {
            barberId_weekDay: {
              barberId: barber.id,
              weekDay: entry.weekDay,
            },
          },
          update: {
            startTime: entry.startTime,
            endTime: entry.endTime,
            isActive: entry.isActive,
          },
          create: {
            barberId: barber.id,
            weekDay: entry.weekDay,
            startTime: entry.startTime,
            endTime: entry.endTime,
            isActive: entry.isActive,
          },
        }),
      ),
    );
  } catch (error) {
    if (error instanceof Error) {
      return mutationError(error.message);
    }

    throw error;
  }

  revalidateBarberViews();
  return mutationSuccess("Disponibilidade da semana salva com sucesso.");
}

export async function createBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const startDateTime = createScheduleDateTimeInput(
    String(formData.get("startDateTime") || ""),
  );
  const endDateTime = createScheduleDateTimeInput(
    String(formData.get("endDateTime") || ""),
  );
  const reason = String(formData.get("reason") || "").trim();

  if (!startDateTime || !endDateTime || startDateTime >= endDateTime) {
    return mutationError("Periodo de bloqueio invalido.");
  }

  await prisma.barberBlock.create({
    data: {
      barberId: barber.id,
      startDateTime,
      endDateTime,
      reason: reason || null,
    },
  });

  revalidateBarberViews();
  return mutationSuccess("Bloqueio criado com sucesso.");
}

export async function updateBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const blockId = String(formData.get("blockId") || "").trim();
  const startDateTime = createScheduleDateTimeInput(
    String(formData.get("startDateTime") || ""),
  );
  const endDateTime = createScheduleDateTimeInput(
    String(formData.get("endDateTime") || ""),
  );
  const reason = String(formData.get("reason") || "").trim();

  if (!startDateTime || !endDateTime || startDateTime >= endDateTime) {
    return mutationError("Periodo de bloqueio invalido.");
  }

  const block = await prisma.barberBlock.findUnique({
    where: { id: blockId },
  });

  if (!block || block.barberId !== barber.id) {
    return mutationError("Bloqueio nao encontrado para este barbeiro.");
  }

  await prisma.barberBlock.update({
    where: { id: block.id },
    data: {
      startDateTime,
      endDateTime,
      reason: reason || null,
    },
  });

  revalidateBarberViews();
  return mutationSuccess("Bloqueio atualizado.");
}

export async function createRecurringBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const weekDay = Number(formData.get("weekDay") || -1);
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (weekDay < 0 || weekDay > 6 || !isValidTimeRange(startTime, endTime)) {
    return mutationError("Bloqueio recorrente invalido.");
  }

  await prisma.recurringBarberBlock.create({
    data: {
      barberId: barber.id,
      weekDay,
      startTime,
      endTime,
      reason: reason || null,
      isActive: true,
    },
  });

  revalidateBarberViews();
  return mutationSuccess("Bloqueio recorrente criado com sucesso.");
}

export async function deleteRecurringBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const recurringBlockId = String(formData.get("recurringBlockId") || "");

  const recurringBlock = await prisma.recurringBarberBlock.findUnique({
    where: { id: recurringBlockId },
  });

  if (!recurringBlock || recurringBlock.barberId !== barber.id) {
    return mutationError(
      "Bloqueio recorrente nao encontrado para este barbeiro.",
    );
  }

  await prisma.recurringBarberBlock.delete({
    where: { id: recurringBlockId },
  });

  revalidateBarberViews();
  return mutationSuccess("Bloqueio recorrente removido.");
}

export async function updateRecurringBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const recurringBlockId = String(formData.get("recurringBlockId") || "");
  const weekDay = Number(formData.get("weekDay") || -1);
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (weekDay < 0 || weekDay > 6 || !isValidTimeRange(startTime, endTime)) {
    return mutationError("Pausa fixa invalida.");
  }

  const recurringBlock = await prisma.recurringBarberBlock.findUnique({
    where: { id: recurringBlockId },
  });

  if (!recurringBlock || recurringBlock.barberId !== barber.id) {
    return mutationError("Pausa fixa nao encontrada para este barbeiro.");
  }

  await prisma.recurringBarberBlock.update({
    where: { id: recurringBlock.id },
    data: {
      weekDay,
      startTime,
      endTime,
      reason: reason || null,
    },
  });

  revalidateBarberViews();
  return mutationSuccess("Pausa fixa atualizada.");
}

export async function deleteBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const blockId = String(formData.get("blockId") || "");

  const block = await prisma.barberBlock.findUnique({
    where: { id: blockId },
  });

  if (!block || block.barberId !== barber.id) {
    return mutationError("Bloqueio nao encontrado para este barbeiro.");
  }

  await prisma.barberBlock.delete({
    where: { id: blockId },
  });

  revalidateBarberViews();
  return mutationSuccess("Bloqueio removido.");
}

export async function saveClientNoteAction(
  formData: FormData,
): Promise<MutationResult> {
  const barber = await requireBarber();
  const customerId = String(formData.get("customerId") || "");
  const note = String(formData.get("note") || "").trim();

  if (!customerId || !note) {
    return mutationError("Anotacao invalida.");
  }

  const hasAppointment = await prisma.appointment.findFirst({
    where: {
      barberId: barber.id,
      customerId,
    },
    select: {
      id: true,
    },
  });

  if (!hasAppointment) {
    return mutationError("Cliente nao vinculado a este barbeiro.");
  }

  await prisma.clientNote.upsert({
    where: {
      barberId_customerId: {
        barberId: barber.id,
        customerId,
      },
    },
    update: {
      note,
    },
    create: {
      barberId: barber.id,
      customerId,
      note,
    },
  });

  revalidateBarberViews();
  revalidatePath(`/barber/clientes/${customerId}`);
  return mutationSuccess("Observacao salva com sucesso.");
}
