import "server-only";

import type { AsaasCreditCardData } from "@/lib/asaas";

function digits(value: FormDataEntryValue | null) {
  return String(value || "").replace(/\D/g, "");
}

function hasValidLuhn(value: string) {
  let sum = 0;
  let double = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function parseVipCreditCard(
  formData: FormData,
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    cpfCnpj: string;
  },
  remoteIp: string
): AsaasCreditCardData {
  const holderName = String(formData.get("cardHolderName") || "").trim();
  const number = digits(formData.get("cardNumber"));
  const expiry = digits(formData.get("cardExpiry"));
  const ccv = digits(formData.get("cardCcv"));
  const postalCode = digits(formData.get("postalCode"));
  const addressNumber = String(formData.get("addressNumber") || "").trim();
  const month = expiry.slice(0, 2);
  const year = expiry.slice(2);
  const expiryDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

  if (holderName.length < 3 || holderName.length > 80) {
    throw new Error("Informe o nome do titular exatamente como está no cartão.");
  }
  if (number.length < 13 || number.length > 19 || !hasValidLuhn(number)) {
    throw new Error("Número do cartão inválido.");
  }
  if (!/^(0[1-9]|1[0-2])\d{4}$/.test(expiry) || expiryDate < new Date()) {
    throw new Error("Validade do cartão inválida. Use MM/AAAA.");
  }
  if (!/^\d{3,4}$/.test(ccv)) throw new Error("Código de segurança inválido.");
  if (!/^\d{8}$/.test(postalCode)) throw new Error("Informe um CEP válido.");
  if (!addressNumber || addressNumber.length > 20) throw new Error("Informe o número do endereço.");
  if (!customer.email) throw new Error("Cadastre um e-mail antes de informar o cartão.");
  if (!remoteIp) throw new Error("Não foi possível identificar a conexão do cliente.");

  const phone = customer.phone?.replace(/\D/g, "") || undefined;
  return {
    creditCard: { holderName, number, expiryMonth: month, expiryYear: year, ccv },
    creditCardHolderInfo: {
      // The holder information is validated by the card acquirer. The user's
      // profile name may be a nickname or account identifier, so it must not
      // replace the legal name entered for the card.
      name: holderName,
      email: customer.email,
      cpfCnpj: customer.cpfCnpj,
      postalCode,
      addressNumber,
      phone,
      mobilePhone: phone,
    },
    remoteIp,
  };
}
