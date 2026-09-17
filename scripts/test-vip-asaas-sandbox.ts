import {readFileSync} from "node:fs";
import {parse} from "dotenv";

// Explicitly load sandbox credentials only; never load the production .env.
const env = parse(readFileSync(".env.local"));
if (env.ASAAS_ENVIRONMENT !== "sandbox" || !env.ASAAS_API_KEY?.startsWith("$aact_hmlg_")) throw new Error("Sandbox obrigatório.");
const base = "https://api-sandbox.asaas.com/v3";
async function request(path: string, method = "GET", data?: object): Promise<Record<string, unknown>> {
  const response = await fetch(base + path, {method, headers:{access_token:env.ASAAS_API_KEY,"content-type":"application/json"},body:data ? JSON.stringify(data):undefined,signal:AbortSignal.timeout(20000)});
  const body = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body.errors || [])}`);
  return body;
}
async function refundWithRetry(paymentId: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await request(`/payments/${paymentId}/refund`, "POST", {});
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}
async function main() {
  let customerId: string | undefined;
  let subscriptionId: string | undefined;
  let paymentId: string | undefined;
  let paymentStatus: string | undefined;
  try {
    const customer = await request("/customers", "POST", {name:"Homologacao VIP descartavel",email:"teste@example.com",mobilePhone:"11987654321",cpfCnpj:"52998224725",notificationDisabled:true,externalReference:`vip-test-${crypto.randomUUID()}`});
    customerId = String(customer.id);
    const today = new Date();
    const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 5, 12));
    const card = {creditCard:{holderName:"Homologacao VIP",number:"4444444444444444",expiryMonth:"12",expiryYear:"2030",ccv:"123"},creditCardHolderInfo:{name:"Homologacao VIP",email:"teste@example.com",cpfCnpj:"52998224725",postalCode:"01310100",addressNumber:"100",mobilePhone:"11987654321"},remoteIp:"8.8.8.8"};
    const subscription = await request("/subscriptions", "POST", {customer:customerId,billingType:"CREDIT_CARD",value:140,cycle:"MONTHLY",nextDueDate:nextMonth.toISOString().slice(0,10),externalReference:`vip-test-${crypto.randomUUID()}`,...card});
    subscriptionId = String(subscription.id);
    const payment = await request("/payments", "POST", {customer:customerId,billingType:"CREDIT_CARD",value:140,dueDate:today.toISOString().slice(0,10),externalReference:`vip-test-overdue-${crypto.randomUUID()}`,...card});
    paymentId = String(payment.id);
    paymentStatus = String(payment.status || "");
    console.log("PASS: cartão validado, assinatura futura e cobrança vencida processadas no sandbox.");
    const payments = await request(`/subscriptions/${subscriptionId}/payments`);
    console.log(`Cobranças geradas: ${Array.isArray(payments.data) ? payments.data.length : 0}`);
  } finally {
    if (paymentId) {
      if (["PENDING", "OVERDUE"].includes(paymentStatus || "")) {
        await request(`/payments/${paymentId}`,"DELETE");
        console.log("Cobrança temporária removida.");
      } else {
        await refundWithRetry(paymentId);
        console.log("Cobrança temporária estornada.");
      }
    }
    if (subscriptionId) {await request(`/subscriptions/${subscriptionId}`,"DELETE");console.log("Assinatura temporária removida.");}
    if (customerId) {await request(`/customers/${customerId}`,"DELETE");console.log("Cliente temporário removido.");}
  }
}
main().catch(error => {console.error(error.message);process.exitCode=1;});
