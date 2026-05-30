import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhoneToWhatsApp } from "@/lib/whatsapp";

test("whatsapp normalizer keeps Brazilian mobile DDD and country code", () => {
  assert.equal(normalizePhoneToWhatsApp("(11) 96590-0713"), "5511965900713");
  assert.equal(normalizePhoneToWhatsApp("11965900713"), "5511965900713");
  assert.equal(normalizePhoneToWhatsApp("+55 11 96590-0713"), "5511965900713");
});

test("whatsapp normalizer repairs legacy mobile numbers without the ninth digit", () => {
  assert.equal(normalizePhoneToWhatsApp("1965900713"), "5519965900713");
});

test("whatsapp normalizer rejects invalid Brazilian mobile numbers", () => {
  assert.equal(normalizePhoneToWhatsApp("11111111111"), null);
  assert.equal(normalizePhoneToWhatsApp("1133334444"), null);
});
