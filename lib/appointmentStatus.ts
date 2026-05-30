export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export function normalizeAppointmentStatus(status: string) {
  if (status === "DONE") {
    return "COMPLETED";
  }

  if (status === "IN_PROGRESS") {
    return "CONFIRMED";
  }

  return status;
}

export function appointmentStatusLabel(status: string) {
  switch (normalizeAppointmentStatus(status)) {
    case "PENDING":
    case "CONFIRMED":
      return "Agendado";
    case "COMPLETED":
      return "Concluido";
    case "CANCELLED":
      return "Cancelado";
    case "NO_SHOW":
      return "Nao compareceu";
    default:
      return "Agendado";
  }
}

export function appointmentStatusColor(status: string) {
  switch (normalizeAppointmentStatus(status)) {
    case "PENDING":
    case "CONFIRMED":
      return "text-green-400";
    case "COMPLETED":
      return "text-blue-400";
    case "CANCELLED":
      return "text-red-400";
    case "NO_SHOW":
      return "text-orange-400";
    default:
      return "text-yellow-400";
  }
}

export function appointmentStatusVariant(status: string) {
  switch (normalizeAppointmentStatus(status)) {
    case "PENDING":
    case "CONFIRMED":
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
    case "NO_SHOW":
      return "warning";
    default:
      return "info";
  }
}
