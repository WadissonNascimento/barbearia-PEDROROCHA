export function getPostLoginRedirect(role?: string | null) {
  if (role === "ADMIN" || role === "SHOP_ADMIN") {
    return "/admin";
  }

  if (role === "BARBER") {
    return "/barber";
  }

  return "/";
}

export function sanitizeInternalRedirect(
  value: FormDataEntryValue | string | null | undefined,
  fallback: string
) {
  const candidate = String(value || "").trim();

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}
