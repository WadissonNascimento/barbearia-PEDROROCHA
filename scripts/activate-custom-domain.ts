import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getDomainReadiness, isLocalOrReservedDomain, normalizeDomainInput } from "@/lib/domainReadiness";
import { basePrisma } from "@/lib/prisma-core";

type CliArgs = Record<string, string | true>;

const LETSENCRYPT_WEBROOT = "/var/www/letsencrypt";
const NGINX_AVAILABLE_DIR = "/etc/nginx/sites-available";
const NGINX_ENABLED_DIR = "/etc/nginx/sites-enabled";
const APP_ORIGIN = "http://127.0.0.1:3000";

function parseArgs(argv: string[]) {
  const parsed: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = argv[index + 1];

    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed[rawKey] = nextValue;
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }

  return parsed;
}

function requiredDomain(args: CliArgs) {
  const rawValue = args.domain;
  const domain = normalizeDomainInput(typeof rawValue === "string" ? rawValue : null);

  if (!domain) {
    throw new Error("Informe o dominio com --domain exemplo.com");
  }

  if (isLocalOrReservedDomain(domain)) {
    throw new Error("Dominio local/reservado nao pode ser ativado em SSL.");
  }

  return domain;
}

function run(command: string, args: string[], options: { dryRun: boolean }) {
  const printable = [command, ...args].join(" ");

  if (options.dryRun) {
    return { command: printable, skipped: true };
  }

  execFileSync(command, args, { stdio: "inherit" });
  return { command: printable, skipped: false };
}

function buildNginxServerBlock(domain: string) {
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    return 301 https://${domain}$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;
}

function nginxFileName(domain: string) {
  return domain.replace(/[^a-z0-9.-]/gi, "-").replace(/\./g, "-");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findExistingNginxConfigForDomain(domain: string) {
  if (!existsSync(NGINX_ENABLED_DIR)) {
    return null;
  }

  const serverNamePattern = new RegExp(
    String.raw`server_name\s+[^;]*\b${escapeRegExp(domain)}\b[^;]*;`,
  );

  for (const entry of readdirSync(NGINX_ENABLED_DIR)) {
    const enabledPath = join(NGINX_ENABLED_DIR, entry);

    try {
      const content = readFileSync(enabledPath, "utf8");

      if (serverNamePattern.test(content)) {
        return enabledPath;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function assertDomainAllowed(domain: string) {
  const response = await fetch(`${APP_ORIGIN}/api/domain-allow?domain=${domain}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Dominio nao autorizado pelo app: HTTP ${response.status}`);
  }

  const body = await response.json();

  if (!body?.ok || body.type !== "shop") {
    throw new Error("Dominio autorizado nao pertence a uma barbearia ativa.");
  }

  return body as {
    ok: true;
    type: "shop";
    domain: string;
    shopId: string;
    shopSlug: string;
    primaryDomain: string;
  };
}

async function assertShopExists(domain: string) {
  const shop = await basePrisma.shop.findFirst({
    where: {
      isActive: true,
      OR: [{ primaryDomain: domain }, { primaryDomain: `www.${domain}` }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      primaryDomain: true,
    },
  });

  if (!shop) {
    throw new Error("Dominio nao esta cadastrado em uma barbearia ativa.");
  }

  return shop;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const execute = args.execute === true;
  const domain = requiredDomain(args);
  const readiness = await getDomainReadiness(domain);

  if (readiness.status !== "ready") {
    throw new Error(`DNS ainda nao esta pronto: ${readiness.label} - ${readiness.message}`);
  }

  const [shop, allowed] = await Promise.all([
    assertShopExists(domain),
    assertDomainAllowed(domain),
  ]);

  if (allowed.shopId !== shop.id) {
    throw new Error("Inconsistencia entre barbearia cadastrada e domain-allow.");
  }

  if (execute && process.env.DOMAIN_ACTIVATION_ENABLED !== "1") {
    throw new Error("Defina DOMAIN_ACTIVATION_ENABLED=1 para executar a ativacao.");
  }

  const fileName = nginxFileName(domain);
  const availablePath = join(NGINX_AVAILABLE_DIR, fileName);
  const enabledPath = join(NGINX_ENABLED_DIR, fileName);
  const certificatePath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
  const nginxBlock = buildNginxServerBlock(domain);
  const existingEnabledPath = findExistingNginxConfigForDomain(domain);
  const dryRun = !execute;
  const commands: Array<{ command: string; skipped: boolean }> = [];

  if (!dryRun) {
    await mkdir(LETSENCRYPT_WEBROOT, { recursive: true });
  }

  if (!existsSync(certificatePath)) {
    commands.push(
      run(
        "certbot",
        ["certonly", "--webroot", "-w", LETSENCRYPT_WEBROOT, "-d", domain],
        { dryRun }
      )
    );
  }

  if (existingEnabledPath) {
    commands.push({ command: `reuse nginx config ${existingEnabledPath}`, skipped: true });
  } else if (dryRun) {
    commands.push({ command: `write ${availablePath}`, skipped: true });
  } else if (existsSync(availablePath) && readFileSync(availablePath, "utf8") !== nginxBlock) {
    throw new Error(`Arquivo Nginx ja existe com conteudo diferente: ${availablePath}`);
  } else if (!existsSync(availablePath)) {
    writeFileSync(availablePath, nginxBlock, "utf8");
  } else {
    commands.push({ command: `reuse nginx config ${availablePath}`, skipped: true });
  }

  if (!existingEnabledPath && !existsSync(enabledPath)) {
    commands.push(run("ln", ["-s", availablePath, enabledPath], { dryRun }));
  }

  commands.push(run("nginx", ["-t"], { dryRun }));
  commands.push(run("systemctl", ["reload", "nginx"], { dryRun }));

  console.info(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "execute",
        domain,
        shop,
        dns: {
          status: readiness.status,
          resolvedIpv4s: readiness.resolvedIpv4s,
          expectedIpv4s: readiness.expectedIpv4s,
        },
        nginx: {
          availablePath,
          enabledPath,
          existingEnabledPath,
          certificatePath,
        },
        commands,
        nextStep: dryRun
          ? "Revise o plano e rode novamente com --execute e DOMAIN_ACTIVATION_ENABLED=1."
          : "Valide HTTP 301 e HTTPS 200 para o dominio.",
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
