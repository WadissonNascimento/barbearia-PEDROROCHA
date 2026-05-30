"use server";

import { revalidatePath } from "next/cache";
import {
  AppointmentMutationError,
  cancelAppointmentByCustomer,
} from "@/lib/appointmentMutations";
import {
  notifyBarberAppointmentCancelled,
  notifyBarberNewReview,
} from "@/lib/barberEmails";
import { notifyAdminsAppointmentCancelled } from "@/lib/appNotifications";
import { prisma } from "@/lib/prisma";
import {
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { CUSTOMER_ROLES, getTenantSession } from "@/lib/tenantSession";

export async function cancelCustomerAppointmentAction(
  formData: FormData
): Promise<MutationResult> {
  const tenantSession = await getTenantSession({
    roles: CUSTOMER_ROLES,
  });

  if (!tenantSession) {
    logSecurityEvent("access_denied", {
      action: "cancelCustomerAppointmentAction",
      role: "anonymous",
    });
    return mutationError("Entre como cliente para cancelar o agendamento.");
  }
  const { session } = tenantSession;

  const appointmentId = String(formData.get("appointmentId") || "").trim();

  if (!appointmentId) {
    return mutationError("Agendamento invalido.");
  }

  const appointment = await prisma.appointment.findUnique({
    where: {
      id: appointmentId,
    },
    select: {
      customerId: true,
      isManualFitIn: true,
      status: true,
      date: true,
    },
  });

  if (
    !appointment ||
    appointment.customerId !== session.user.id ||
    appointment.isManualFitIn
  ) {
    logSecurityEvent("idor_blocked", {
      action: "cancelCustomerAppointmentAction",
      userId: session.user.id,
      appointmentId,
    });
    return mutationError("Agendamento nao encontrado para sua conta.");
  }

  try {
    await cancelAppointmentByCustomer({
      appointmentId,
      customerId: session.user.id,
    });
  } catch (error) {
    if (error instanceof AppointmentMutationError) {
      return mutationError(error.message);
    }

    throw error;
  }

  revalidatePath("/customer/agendamentos");
  revalidatePath("/agendar");
  revalidatePath("/admin/agenda");
  revalidatePath("/barber");
  revalidatePath("/barber/agenda");

  await notifyBarberAppointmentCancelled(appointmentId, "Cancelado pelo cliente.");
  await notifyAdminsAppointmentCancelled(appointmentId, "Cancelado pelo cliente.");

  return mutationSuccess("Agendamento cancelado com sucesso.");
}

export async function submitAppointmentReviewAction(
  formData: FormData
): Promise<MutationResult> {
  const tenantSession = await getTenantSession({
    roles: CUSTOMER_ROLES,
  });

  if (!tenantSession) {
    logSecurityEvent("access_denied", {
      action: "submitAppointmentReviewAction",
      role: "anonymous",
    });
    return mutationError("Entre como cliente para avaliar o atendimento.");
  }
  const { session } = tenantSession;

  const rateLimit = await enforceRateLimit({
    scope: "review:create",
    identifier: session.user.id,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return mutationError("Muitas avaliacoes em pouco tempo. Aguarde e tente novamente.");
  }

  const appointmentId = String(formData.get("appointmentId") || "").trim();
  const rating = Number(formData.get("rating") || 0);
  const comment = String(formData.get("comment") || "").trim();

  if (!appointmentId) {
    return mutationError("Agendamento invalido.");
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return mutationError("Escolha uma nota de 1 a 5.");
  }

  if (comment.length > 50) {
    return mutationError("Escreva uma avaliacao com ate 50 caracteres.");
  }

  const appointment = await prisma.appointment.findUnique({
    where: {
      id: appointmentId,
    },
    select: {
      id: true,
      customerId: true,
      barberId: true,
      isManualFitIn: true,
      status: true,
    },
  });

  if (
    !appointment ||
    appointment.customerId !== session.user.id ||
    appointment.isManualFitIn
  ) {
    logSecurityEvent("idor_blocked", {
      action: "submitAppointmentReviewAction",
      userId: session.user.id,
      appointmentId,
    });
    return mutationError("Agendamento nao encontrado para sua conta.");
  }

  if (!["COMPLETED", "DONE"].includes(appointment.status)) {
    return mutationError("A avaliacao fica disponivel depois que o atendimento e concluido.");
  }

  const existingReview = await prisma.review.findUnique({
    where: {
      appointmentId,
    },
    select: {
      id: true,
    },
  });

  if (existingReview) {
    return mutationError("Esse atendimento ja foi avaliado.");
  }

  const review = await prisma.review.create({
    data: {
      appointmentId,
      customerId: session.user.id,
      barberId: appointment.barberId,
      rating,
      comment,
    },
  });

  revalidatePath("/");
  revalidatePath("/avaliacoes");
  revalidatePath("/customer/agendamentos");
  revalidatePath("/admin/avaliacoes");

  await notifyBarberNewReview(review.id);

  return mutationSuccess("Obrigado pela avaliacao. Ela ja entrou para revisao do admin.");
}
