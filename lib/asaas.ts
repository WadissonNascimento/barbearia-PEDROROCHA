import "server-only";
import { isVipAsaasPaymentsEnabled } from "@/lib/vipBillingPolicy";

export const VIP_ASAAS_BILLING_TYPES = ["PIX", "BOLETO", "CREDIT_CARD"] as const;
export type VipAsaasBillingType = (typeof VIP_ASAAS_BILLING_TYPES)[number];

type AsaasList<T> = {
  data: T[];
};

export type AsaasCustomer = {
  id: string;
  name: string;
  email?: string | null;
  mobilePhone?: string | null;
  cpfCnpj?: string | null;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: VipAsaasBillingType;
  value: number;
  nextDueDate: string;
  cycle: "MONTHLY";
  status: string;
  externalReference?: string | null;
};

export type AsaasPayment = {
  id: string;
  billingType?: VipAsaasBillingType;
  subscription?: string | null;
  status: string;
  value: number;
  dueDate: string;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  pixTransaction?: string | null;
  externalReference?: string | null;
  creditCardToken?: string | null;
};

export type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate?: string | null;
};

export type AsaasCreditCardData = {
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
    mobilePhone?: string;
  };
  remoteIp: string;
};

type AsaasProblem = {
  errors?: Array<{ description?: string; code?: string }>;
};

export class AsaasApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: AsaasProblem
  ) {
    super(message);
    this.name = "AsaasApiError";
  }
}

function readRuntimeEnv(name: "ASAAS_API_KEY" | "ASAAS_ENVIRONMENT") {
  return process.env[name]?.trim();
}

function getAsaasApiBaseUrl() {
  const environment = readRuntimeEnv("ASAAS_ENVIRONMENT")?.toLowerCase() || "";
  if (!["sandbox", "production"].includes(environment)) throw new Error("Defina explicitamente ASAAS_ENVIRONMENT.");
  return environment === "sandbox"
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

function getAsaasApiKey() {
  const apiKey = readRuntimeEnv("ASAAS_API_KEY");

  if (!apiKey) {
    throw new Error(
      "A cobrança VIP ainda não está configurada. Defina ASAAS_API_KEY no ambiente."
    );
  }

  return apiKey;
}

export function isAsaasVipBillingConfigured() {
  const environment = readRuntimeEnv("ASAAS_ENVIRONMENT")?.toLowerCase() || "";
  return (
    isVipAsaasPaymentsEnabled() &&
    Boolean(readRuntimeEnv("ASAAS_API_KEY")) &&
    ["sandbox", "production"].includes(environment)
  );
}

async function asaasRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 20_000
): Promise<T> {
  const response = await fetch(`${getAsaasApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      access_token: getAsaasApiKey(),
      "content-type": "application/json",
      "user-agent": "PedroRochaBarbearia/1.0 (VIP billing)",
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = (await response.json().catch(() => null)) as T | AsaasProblem | null;

  if (!response.ok) {
    const problem = body as AsaasProblem | null;
    const description = problem?.errors?.[0]?.description;
    throw new AsaasApiError(
      description || `Asaas respondeu com erro ${response.status}.`,
      response.status,
      problem || undefined
    );
  }

  return body as T;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function createAsaasCustomer(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  cpfCnpj?: string | null;
  externalReference: string;
}) {
  return asaasRequest<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email || undefined,
      mobilePhone: input.phone?.replace(/\D/g, "") || undefined,
      cpfCnpj: input.cpfCnpj || undefined,
      externalReference: input.externalReference,
    }),
  });
}

export async function findAsaasCustomer(reference: string) {
  const result = await asaasRequest<AsaasList<AsaasCustomer>>(
    `/customers?externalReference=${encodeURIComponent(reference)}`
  );
  if (result.data.length > 1) {
    throw new Error("Clientes duplicados no Asaas: necessária conciliação.");
  }
  return result.data[0] || null;
}

export async function updateAsaasCustomer(customerId: string, input: {
  cpfCnpj: string;
  name?: string;
  email?: string;
  mobilePhone?: string;
}) {
  return asaasRequest<AsaasCustomer>(`/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

// This endpoint validates/replaces the card, but does not capture a payment.
export async function updateAsaasSubscriptionCreditCard(subscriptionId: string, card: AsaasCreditCardData) {
  return asaasRequest<AsaasSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}/creditCard`, {
    method: "PUT",
    body: JSON.stringify(card),
  }, 65_000);
}

export async function getAsaasSubscription(subscriptionId: string) {
  return asaasRequest<AsaasSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function updateAsaasPayment(paymentId: string, input: {
  billingType: VipAsaasBillingType;
  value: number;
  dueDate: string;
}) {
  return asaasRequest<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function createAsaasVipSubscription(input: {
  customerId: string;
  billingType: VipAsaasBillingType;
  value: number;
  nextDueDate: Date;
  description: string;
  externalReference: string;
  card?: AsaasCreditCardData;
}) {
  return asaasRequest<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      nextDueDate: dateOnly(input.nextDueDate),
      cycle: "MONTHLY",
      description: input.description,
      externalReference: input.externalReference,
      ...(input.card || {}),
    }),
  }, input.card ? 65_000 : 20_000);
}

export async function createAsaasPayment(input: {
  customerId: string;
  billingType: VipAsaasBillingType;
  value: number;
  dueDate: Date;
  description: string;
  externalReference: string;
  card?: AsaasCreditCardData;
}) {
  return asaasRequest<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      dueDate: dateOnly(input.dueDate),
      description: input.description,
      externalReference: input.externalReference,
      ...(input.card || {}),
    }),
  }, input.card ? 65_000 : 20_000);
}

export async function findAsaasPayment(reference: string) {
  const result = await asaasRequest<AsaasList<AsaasPayment>>(
    `/payments?externalReference=${encodeURIComponent(reference)}`
  );
  if (result.data.length > 1) {
    throw new Error("Cobranças duplicadas no Asaas: necessária conciliação.");
  }
  return result.data[0] || null;
}

export async function updateAsaasVipSubscription(
  subscriptionId: string,
  input: {
    billingType?: VipAsaasBillingType;
    value?: number;
    nextDueDate?: Date;
    description?: string;
    status?: "ACTIVE" | "INACTIVE";
    updatePendingPayments?: boolean;
  }
) {
  return asaasRequest<AsaasSubscription>(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...input,
      nextDueDate: input.nextDueDate ? dateOnly(input.nextDueDate) : undefined,
    }),
  });
}

export async function deleteAsaasVipSubscription(subscriptionId: string) {
  return asaasRequest<AsaasSubscription>(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}

export async function listAsaasSubscriptionPayments(subscriptionId: string) {
  const payments: AsaasPayment[] = [];
  for (let offset = 0; ; offset += 100) {
    const result = await asaasRequest<AsaasList<AsaasPayment> & {hasMore: boolean}>(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=100&offset=${offset}`);
    payments.push(...result.data);
    if (!result.hasMore) return payments;
  }
}

export async function findAsaasSubscription(reference: string) {
  const result = await asaasRequest<AsaasList<AsaasSubscription>>(`/subscriptions?externalReference=${encodeURIComponent(reference)}`);
  if (result.data.length > 1) throw new Error("Assinaturas duplicadas: necessária conciliação.");
  return result.data[0] || null;
}

export async function getAsaasPayment(paymentId: string) {
  return asaasRequest<AsaasPayment>(`/payments/${paymentId}`);
}

export async function getAsaasPixQrCode(paymentId: string) {
  return asaasRequest<AsaasPixQrCode>(
    `/payments/${encodeURIComponent(paymentId)}/pixQrCode`
  );
}

export function getVipAsaasExternalReference(shopId: string, subscriptionId: string) {
  return `vip:${shopId}:${subscriptionId}`;
}
