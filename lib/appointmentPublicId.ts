export function formatAppointmentPublicId(publicId: number | null | undefined) {
  if (!Number.isFinite(publicId) || !publicId || publicId < 1) {
    return "#--------";
  }

  return `#${Math.trunc(publicId).toString().padStart(8, "0")}`;
}
