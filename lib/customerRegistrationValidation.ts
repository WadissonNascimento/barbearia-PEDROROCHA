export const FULL_NAME_REQUIREMENT_MESSAGE = "Informe nome e sobrenome.";

export const CUSTOMER_PASSWORD_REQUIREMENT_MESSAGE =
  "A senha deve ter no minimo 8 caracteres, uma letra e um numero.";

export function normalizeCustomerName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function isValidCustomerFullName(name: string) {
  const parts = normalizeCustomerName(name).split(" ").filter(Boolean);

  return parts.length >= 2 && parts.every((part) => part.length >= 2);
}

export function isValidCustomerPassword(password: string) {
  return password.length >= 8 && /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password);
}
