import assert from "node:assert/strict";
import test from "node:test";
import { updateVipAsaasPreferences } from "../lib/vipAsaasPreferences";
import { getVipBillingErrorMessage } from "../lib/vipBillingErrors";
import { needsVipBillingUpdate, parseVipBillingType } from "../lib/vipBillingPolicy";
import type { AsaasCreditCardData } from "../lib/asaas";

const card: AsaasCreditCardData = {
  creditCard: { holderName: "Test Customer", number: "4111111111111111", expiryMonth: "12", expiryYear: "2099", ccv: "123" },
  creditCardHolderInfo: { name: "Test Customer", email: "test@example.invalid", cpfCnpj: "12345678909", postalCode: "01001000", addressNumber: "1" },
  remoteIp: "127.0.0.1",
};

for (const method of ["PIX", "BOLETO", "CREDIT_CARD"] as const) {
  test(`change to ${method} updates existing resources, preserving due dates and paid invoices`, async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
    let billingType = "CREDIT_CARD";
    const oldEnv = { ASAAS_API_KEY: process.env.ASAAS_API_KEY, ASAAS_ENVIRONMENT: process.env.ASAAS_ENVIRONMENT };
    process.env.ASAAS_API_KEY = "mock-only";
    process.env.ASAAS_ENVIRONMENT = "sandbox";
    globalThis.fetch = async (url, init) => {
      assert.ok(String(url).startsWith("https://api-sandbox.asaas.com/v3/"));
      const path = new URL(String(url)).pathname;
      const method = init?.method || "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push({ path, method, body });
      if (path === "/v3/subscriptions/sub_test" && method === "PUT") billingType = body.billingType;
      if (path.endsWith("/payments")) return Response.json({ data: [{ id: "pay_future", status: "PENDING", billingType }], hasMore: false });
      if (path === "/v3/payments/pay_paid") return Response.json({ id: "pay_paid", status: "RECEIVED", value: 10, billingType: "CREDIT_CARD", dueDate: "2026-08-16" });
      if (path === "/v3/payments/pay_overdue") return Response.json({ id: "pay_overdue", status: "OVERDUE", value: 10, billingType: "BOLETO", dueDate: "2026-09-16" });
      return Response.json({ id: "sub_test", status: "ACTIVE", billingType, nextDueDate: "2026-10-16" });
    };
    try {
      await updateVipAsaasPreferences({ subscriptionId: "sub_test", billingType: method, card: method === "CREDIT_CARD" ? card : undefined, standalonePaymentIds: ["pay_paid", "pay_overdue"] });
      assert.ok(!calls.some(call => call.method === "POST" || call.method === "DELETE"), "No replacement, duplicate recurrence or immediate capture");
      assert.ok(!calls.some(call => call.path.endsWith("pay_paid") && call.method !== "GET"));
      const subscriptionUpdate = calls.find(call => call.path === "/v3/subscriptions/sub_test" && call.method === "PUT");
      assert.deepEqual(subscriptionUpdate?.body, { billingType: method, updatePendingPayments: true });
      for (const call of calls.filter(call => call.path.endsWith("pay_overdue") && call.method === "PUT")) {
        assert.equal(call.body.dueDate, "2026-09-16");
        assert.equal(call.body.value, 10);
      }
      const cardCalls = calls.filter(call => call.path.endsWith("/creditCard"));
      assert.equal(cardCalls.length, method === "CREDIT_CARD" ? 1 : 0);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
  });
}

test("card refusal leaves the recurrence method untouched and gives a useful safe message", async () => {
  const originalFetch = globalThis.fetch;
  const env = { key: process.env.ASAAS_API_KEY, mode: process.env.ASAAS_ENVIRONMENT };
  process.env.ASAAS_API_KEY = "mock-only";
  process.env.ASAAS_ENVIRONMENT = "sandbox";
  const writes: string[] = [];
  globalThis.fetch = async (url, init) => {
    if (init?.method === "PUT") {
      writes.push(String(url));
      return Response.json({ errors: [{ description: "Transação não autorizada. Verifique os dados do cartão de crédito e tente novamente." }] }, { status: 400 });
    }
    return Response.json({ id: "sub_test", status: "ACTIVE", billingType: "PIX" });
  };
  try {
    await assert.rejects(updateVipAsaasPreferences({ subscriptionId: "sub_test", billingType: "CREDIT_CARD", card, standalonePaymentIds: [] }), error => {
      assert.match(getVipBillingErrorMessage(error), /cartão não foi autorizado/);
      assert.match(getVipBillingErrorMessage(error), /Pix\/boleto/);
      return true;
    });
    assert.equal(writes.length, 1);
    assert.ok(writes[0].endsWith("/creditCard"));
  } finally {
    globalThis.fetch = originalFetch;
    if (env.key === undefined) delete process.env.ASAAS_API_KEY; else process.env.ASAAS_API_KEY = env.key;
    if (env.mode === undefined) delete process.env.ASAAS_ENVIRONMENT; else process.env.ASAAS_ENVIRONMENT = env.mode;
  }
});

test("all subscribers, including linked card users, must explicitly confirm their method", () => {
  assert.equal(needsVipBillingUpdate({ asaasSubscriptionId: "sub_existing", billingProfileConfirmedAt: null }), true);
  assert.equal(needsVipBillingUpdate({ asaasSubscriptionId: null, billingProfileConfirmedAt: new Date() }), true);
  assert.equal(needsVipBillingUpdate({ asaasSubscriptionId: "sub_existing", billingProfileConfirmedAt: new Date() }), false);
  assert.throws(() => parseVipBillingType("UNDEFINED"));
  assert.throws(() => parseVipBillingType(null));
  assert.equal(parseVipBillingType("PIX"), "PIX");
});
