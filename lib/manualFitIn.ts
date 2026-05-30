export function formatManualFitInNotes({
  customerName,
  customerPhone,
  notes,
}: {
  customerName: string;
  customerPhone?: string | null;
  notes?: string | null;
}) {
  const details = [
    `Cliente: ${customerName || "Cliente sem cadastro"}`,
    customerPhone ? `Telefone: ${customerPhone}` : "",
    notes ? `Obs: ${notes}` : "",
  ].filter(Boolean);

  return `Encaixe Manual | ${details.join(" | ")}`;
}

export function getManualFitInCustomerSnapshot(notes: string | null | undefined) {
  const rawNotes = String(notes || "");
  const name = rawNotes.match(/(?:^|\|\s*)Cliente:\s*([^|]+)/)?.[1]?.trim() || "";
  const phone = rawNotes.match(/(?:^|\|\s*)Telefone:\s*([^|]+)/)?.[1]?.trim() || "";

  return {
    name,
    phone,
  };
}

function isManualFitInPlaceholderName(name: string | null | undefined) {
  const normalizedName = String(name || "")
    .trim()
    .toLowerCase();

  return (
    !normalizedName ||
    normalizedName === "encaixe manual" ||
    normalizedName === "cliente sem cadastro"
  );
}

export function getManualFitInCustomerDisplay({
  notes,
  fallbackCustomer,
}: {
  notes: string | null | undefined;
  fallbackCustomer?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}) {
  const snapshot = getManualFitInCustomerSnapshot(notes);
  const fallbackName = fallbackCustomer?.name?.trim() || "";
  const fallbackPhone = fallbackCustomer?.phone?.trim() || "";

  return {
    name:
      snapshot.name ||
      (!isManualFitInPlaceholderName(fallbackName)
        ? fallbackName
        : "Cliente sem cadastro"),
    phone: snapshot.phone || fallbackPhone || null,
    email: fallbackCustomer?.email || null,
  };
}

export function getManualFitInVisibleNotes(notes: string | null | undefined) {
  const rawNotes = String(notes || "").trim();

  if (!rawNotes) {
    return "";
  }

  const isManualFitInMetadata =
    rawNotes.includes("Encaixe Manual") ||
    /(?:^|\|\s*)Cliente:\s*[^|]+/.test(rawNotes) ||
    /(?:^|\|\s*)Telefone:\s*[^|]+/.test(rawNotes) ||
    /(?:^|\|\s*)Obs:\s*[^|]+/.test(rawNotes);

  if (!isManualFitInMetadata) {
    return rawNotes;
  }

  const obs = rawNotes.match(/(?:^|\|\s*)Obs:\s*([^|]+)/)?.[1]?.trim() || "";

  return obs;
}

export function mergeManualFitInNotes({
  currentNotes,
  nextVisibleNotes,
}: {
  currentNotes: string | null | undefined;
  nextVisibleNotes: string | null | undefined;
}) {
  const snapshot = getManualFitInCustomerSnapshot(currentNotes);
  const visibleNotes = getManualFitInVisibleNotes(nextVisibleNotes);

  if (!snapshot.name && !snapshot.phone) {
    return visibleNotes || currentNotes || null;
  }

  return formatManualFitInNotes({
    customerName: snapshot.name || "Cliente sem cadastro",
    customerPhone: snapshot.phone || null,
    notes: visibleNotes || null,
  });
}
