import test from "node:test";
import assert from "node:assert/strict";

test("Webhook persiste, ignora duplicatas e consulta estado atual para eventos atrasados", {skip: process.env.VIP_INTEGRATION_TEST !== "1"}, async () => {
  if (process.env.DATABASE_URL !== "postgresql://wadisson@127.0.0.1:55439/postgres") throw new Error("Execute somente no banco descartável local.");
  const {basePrisma: db} = await import("../lib/prisma-core");
  const {processAsaasVipWebhook} = await import("../lib/asaasVipWebhook");
  const id = `test-${crypto.randomUUID()}`;
  const shop = await db.shop.create({data: {id, name:"VIP test",slug:id}});
  const user = await db.user.create({data: {shopId:shop.id}});
  const plan = await db.vipPlan.create({data:{shopId:shop.id,code:"TEST",name:"Prata",price:140}});
  const sub = await db.vipSubscription.create({data:{shopId:shop.id,customerId:user.id,planId:plan.id,asaasSubscriptionId:id,cycleStart:new Date("2026-09-01"),cycleEnd:new Date("2026-10-01")}});
  const originalFetch = globalThis.fetch;
  let status = "RECEIVED";
  let providerPayment: Record<string, unknown> = {id,subscription:id,value:140,dueDate:"2026-09-05",paymentDate:"2026-09-15"};
  globalThis.fetch = async () => new Response(JSON.stringify({...providerPayment,status}));
  process.env.ASAAS_ENVIRONMENT = "sandbox";
  process.env.ASAAS_API_KEY = "mock-sandbox-test";
  try {
    const event = {id:`event-${id}`,event:"PAYMENT_RECEIVED",payment:{id,subscription:id}};
    await processAsaasVipWebhook(event);
    assert.equal((await db.vipPayment.findFirstOrThrow({where:{subscriptionId:sub.id}})).status,"PAID");
    assert.equal((await processAsaasVipWebhook(event)).ignored,true);
    await processAsaasVipWebhook({...event,id:`old-${id}`,event:"PAYMENT_OVERDUE"});
    assert.equal((await db.vipPayment.findFirstOrThrow({where:{subscriptionId:sub.id}})).status,"PAID");
    status = "REFUNDED";
    await processAsaasVipWebhook({...event,id:`refund-${id}`,event:"PAYMENT_REFUNDED"});
    assert.equal((await db.vipPayment.findFirstOrThrow({where:{subscriptionId:sub.id}})).status,"PENDING");
    assert.equal((await db.vipSubscription.findUniqueOrThrow({where:{id:sub.id}})).tokensRemaining,4);
    assert.equal(await db.vipPayment.count({where:{subscriptionId:sub.id}}),1);
    const standaloneId = `standalone-${id}`;
    await db.vipPayment.create({data:{shopId:shop.id,subscriptionId:sub.id,cycleMonth:"2026-08",amount:140,status:"PENDING",dueDate:new Date("2026-08-05T12:00:00Z"),asaasPaymentId:standaloneId,externalReference:`vip-payment:${shop.id}:${sub.id}:2026-08`}});
    status = "RECEIVED";
    providerPayment = {id:standaloneId,value:140,dueDate:"2026-09-16",paymentDate:"2026-09-16"};
    await processAsaasVipWebhook({id:`standalone-event-${id}`,event:"PAYMENT_RECEIVED",payment:{id:standaloneId}});
    const standalone = await db.vipPayment.findUniqueOrThrow({where:{asaasPaymentId:standaloneId}});
    assert.equal(standalone.cycleMonth,"2026-08");
    assert.equal(standalone.status,"PAID");
    assert.equal(standalone.dueDate?.toISOString().slice(0,10),"2026-08-05");

    // Generated invoices must actually change at the provider AND in our DB.
    const futureId = `future-${id}`;
    const { getVipDueDateForCycle } = await import("../lib/vipDueDate");
    const expectedDue = getVipDueDateForCycle("2090-10", 5).toISOString().slice(0, 10);
    let remoteDue = "2090-10-01";
    status = "PENDING";
    const updates: unknown[] = [];
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "PUT") {
        const update = JSON.parse(String(init.body));
        updates.push(update);
        remoteDue = update.dueDate;
      }
      return Response.json({ id: futureId, subscription: id, billingType: "PIX", status, dueDate: remoteDue, value: 140 });
    };
    await db.vipPayment.create({ data: { shopId: shop.id, subscriptionId: sub.id, cycleMonth: "2090-10", amount: 140, status: "PENDING", dueDate: new Date("2090-10-01T12:00:00Z"), asaasPaymentId: futureId } });
    await processAsaasVipWebhook({ id: `future-event-${id}`, event: "PAYMENT_CREATED", payment: { id: futureId, subscription: id } });
    assert.equal(updates.length, 1);
    assert.equal(remoteDue, expectedDue);
    assert.equal((await db.vipPayment.findUniqueOrThrow({where:{asaasPaymentId:futureId}})).dueDate?.toISOString().slice(0,10),expectedDue);
    // A replay is idempotent; a received payment is never rescheduled.
    await processAsaasVipWebhook({ id: `future-event-${id}`, event: "PAYMENT_CREATED", payment: { id: futureId, subscription: id } });
    assert.equal(updates.length, 1);
    status = "RECEIVED";
    await processAsaasVipWebhook({ id: `future-paid-${id}`, event: "PAYMENT_RECEIVED", payment: { id: futureId, subscription: id } });
    assert.equal(updates.length, 1);
    assert.equal((await db.vipPayment.findUniqueOrThrow({where:{asaasPaymentId:futureId}})).status,"PAID");
  } finally {
    globalThis.fetch = originalFetch;
    await db.shop.delete({where:{id:shop.id}});
    await db.$disconnect();
  }
});
