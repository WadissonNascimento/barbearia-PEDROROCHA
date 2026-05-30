const VALID_BRAZILIAN_DDDS = new Set([
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "21",
  "22",
  "24",
  "27",
  "28",
  "31",
  "32",
  "33",
  "34",
  "35",
  "37",
  "38",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "53",
  "54",
  "55",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "71",
  "73",
  "74",
  "75",
  "77",
  "79",
  "81",
  "82",
  "83",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
]);

export const BRAZILIAN_PHONE_EXAMPLE = "(11) 96590-0713";
export const BRAZILIAN_PHONE_PATTERN = "\\([1-9][0-9]\\) 9[0-9]{4}-[0-9]{4}";

export function stripPhoneDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeBrazilianMobileDigits(value: string | null | undefined) {
  let digits = stripPhoneDigits(value);

  if (digits.length === 13 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 11);
}

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function isValidBrazilianPhone(value: string | null | undefined) {
  const digits = normalizeBrazilianMobileDigits(value);
  const ddd = digits.slice(0, 2);

  return (
    digits.length === 11 &&
    VALID_BRAZILIAN_DDDS.has(ddd) &&
    digits[2] === "9" &&
    !hasRepeatedDigits(digits)
  );
}

export function maskBrazilianPhone(value: string | null | undefined) {
  const digits = normalizeBrazilianMobileDigits(value);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function formatBrazilianPhone(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const masked = maskBrazilianPhone(value);
  return isValidBrazilianPhone(masked) ? masked : String(value).trim();
}

export function normalizeBrazilianPhoneForSubmit(value: string | null | undefined) {
  const masked = maskBrazilianPhone(value);
  return isValidBrazilianPhone(masked) ? masked : "";
}
