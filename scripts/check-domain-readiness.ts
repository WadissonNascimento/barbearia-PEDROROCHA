import { getDomainReadiness, normalizeDomainInput } from "@/lib/domainReadiness";
import { basePrisma } from "@/lib/prisma-core";

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));

  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const domain = normalizeDomainInput(getArgValue("domain"));

  if (!domain) {
    throw new Error("Informe o dominio com --domain exemplo.com");
  }

  const shop = await basePrisma.shop.findFirst({
    where: {
      OR: [{ primaryDomain: domain }, { primaryDomain: `www.${domain}` }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      primaryDomain: true,
      isActive: true,
    },
  });

  const readiness = await getDomainReadiness(domain);

  console.log(
    JSON.stringify(
      {
        mode: "read_only",
        domain,
        shop: shop || null,
        status: readiness.status,
        label: readiness.label,
        expectedIpv4s: readiness.expectedIpv4s,
        resolvedIpv4s: readiness.resolvedIpv4s,
        message: readiness.message,
        nextStep:
          readiness.status === "ready" && shop?.isActive
            ? "Pronto para solicitar SSL e adicionar ao catch-all do Nginx."
            : "Corrija o DNS/cadastro antes de ativar SSL.",
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
