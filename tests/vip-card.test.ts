import assert from "node:assert/strict";
import test from "node:test";
import { getVipAsaasPayerName, parseVipCreditCard } from "../lib/vipCard";

test("card holder information uses the name entered for the card, not the account nickname", () => {
  const formData = new FormData();
  formData.set("cardHolderName", "Titular Legal");
  formData.set("cardNumber", "4111111111111111");
  formData.set("cardExpiry", "12/2099");
  formData.set("cardCcv", "123");
  formData.set("postalCode", "01001000");
  formData.set("addressNumber", "10");

  const card = parseVipCreditCard(
    formData,
    {
      name: "apelido-da-conta",
      email: "cliente@example.invalid",
      phone: null,
      cpfCnpj: "12345678909",
    },
    "203.0.113.10"
  );

  assert.equal(card.creditCard.holderName, "Titular Legal");
  assert.equal(card.creditCardHolderInfo.name, "Titular Legal");
  assert.equal(
    getVipAsaasPayerName(
      { name: "apelido-da-conta", email: "cliente@example.invalid" },
      card
    ),
    "Titular Legal"
  );
});
