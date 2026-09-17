import { config } from "dotenv";

config({ path: new URL("../.env", import.meta.url).pathname, quiet: true });

const secret = process.env.CRON_SECRET;
if (!secret) throw new Error("CRON_SECRET não configurado.");

const response = await fetch(
  `https://barbeariarocha.com.br/api/cron/vip-asaas-reconciliation?run=${Date.now()}`,
  {
    cache: "no-store",
    headers: { authorization: `Bearer ${secret}` },
  }
);

if (!response.ok) {
  throw new Error(`Reconciliação VIP respondeu HTTP ${response.status}.`);
}
