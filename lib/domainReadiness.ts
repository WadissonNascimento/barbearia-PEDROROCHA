import { resolve4 } from "node:dns/promises";

const DEFAULT_EXPECTED_IPV4S = ["2.24.65.212"];
const DNS_TIMEOUT_MS = 1_500;

export type DomainReadiness =
  | {
      status: "missing";
      label: "Sem dominio";
      tone: "muted";
      domain: null;
      expectedIpv4s: string[];
      resolvedIpv4s: string[];
      message: string;
    }
  | {
      status: "local";
      label: "Local/teste";
      tone: "muted";
      domain: string;
      expectedIpv4s: string[];
      resolvedIpv4s: string[];
      message: string;
    }
  | {
      status: "ready";
      label: "DNS OK";
      tone: "success";
      domain: string;
      expectedIpv4s: string[];
      resolvedIpv4s: string[];
      message: string;
    }
  | {
      status: "wrong_target";
      label: "DNS aponta fora";
      tone: "warning";
      domain: string;
      expectedIpv4s: string[];
      resolvedIpv4s: string[];
      message: string;
    }
  | {
      status: "pending";
      label: "DNS pendente";
      tone: "warning";
      domain: string;
      expectedIpv4s: string[];
      resolvedIpv4s: string[];
      message: string;
    }
  | {
      status: "error";
      label: "DNS indisponivel";
      tone: "danger";
      domain: string;
      expectedIpv4s: string[];
      resolvedIpv4s: string[];
      message: string;
    };

export function normalizeDomainInput(value: string | null | undefined) {
  const raw = value?.trim().toLowerCase();

  if (!raw) {
    return null;
  }

  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return raw.split("/")[0]?.replace(/:\d+$/, "").replace(/^www\./, "") || null;
  }
}

export function getExpectedDomainIpv4s() {
  const configured = process.env.DOMAIN_EXPECTED_IPV4S || process.env.PUBLIC_IPV4;
  const values = configured
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values?.length ? values : DEFAULT_EXPECTED_IPV4S;
}

export function isLocalOrReservedDomain(domain: string) {
  return (
    domain === "localhost" ||
    domain.endsWith(".localhost") ||
    domain.endsWith(".test") ||
    domain.endsWith(".invalid") ||
    domain === "example.com" ||
    domain.endsWith(".example.com") ||
    domain === "example.net" ||
    domain.endsWith(".example.net") ||
    domain === "example.org" ||
    domain.endsWith(".example.org")
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("dns_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function getDomainReadiness(
  value: string | null | undefined
): Promise<DomainReadiness> {
  const domain = normalizeDomainInput(value);
  const expectedIpv4s = getExpectedDomainIpv4s();

  if (!domain) {
    return {
      status: "missing",
      label: "Sem dominio",
      tone: "muted",
      domain: null,
      expectedIpv4s,
      resolvedIpv4s: [],
      message: "Nenhum dominio principal cadastrado.",
    };
  }

  if (isLocalOrReservedDomain(domain)) {
    return {
      status: "local",
      label: "Local/teste",
      tone: "muted",
      domain,
      expectedIpv4s,
      resolvedIpv4s: [],
      message: "Dominio reservado para testes locais; nao deve receber SSL em producao.",
    };
  }

  try {
    const resolvedIpv4s = await withTimeout(resolve4(domain), DNS_TIMEOUT_MS);
    const pointsToExpectedServer = resolvedIpv4s.some((ip) => expectedIpv4s.includes(ip));

    if (pointsToExpectedServer) {
      return {
        status: "ready",
        label: "DNS OK",
        tone: "success",
        domain,
        expectedIpv4s,
        resolvedIpv4s,
        message: "O dominio ja aponta para a VPS esperada.",
      };
    }

    return {
      status: "wrong_target",
      label: "DNS aponta fora",
      tone: "warning",
      domain,
      expectedIpv4s,
      resolvedIpv4s,
      message: "O dominio resolve, mas ainda nao aponta para a VPS esperada.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "dns_error";
    const isPending = /ENOTFOUND|ENODATA|ETIMEOUT|dns_timeout/i.test(message);

    if (isPending) {
      return {
        status: "pending",
        label: "DNS pendente",
        tone: "warning",
        domain,
        expectedIpv4s,
        resolvedIpv4s: [],
        message: "Ainda nao existe apontamento A valido para este dominio.",
      };
    }

    return {
      status: "error",
      label: "DNS indisponivel",
      tone: "danger",
      domain,
      expectedIpv4s,
      resolvedIpv4s: [],
      message: `Falha ao consultar DNS: ${message}`,
    };
  }
}
