import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidCustomerFullName,
  isValidCustomerPassword,
  normalizeCustomerName,
} from "@/lib/customerRegistrationValidation";

test("customer registration requires first and last name", () => {
  assert.equal(isValidCustomerFullName("Antônio Silva"), true);
  assert.equal(isValidCustomerFullName("  Antônio   Silva  "), true);
  assert.equal(normalizeCustomerName("  Antônio   Silva  "), "Antônio Silva");
  assert.equal(isValidCustomerFullName("Antônio"), false);
  assert.equal(isValidCustomerFullName("A Silva"), false);
});

test("customer registration password requires 8 characters, letters and at least one number", () => {
  assert.equal(isValidCustomerPassword("senha123"), true);
  assert.equal(isValidCustomerPassword("Cliente2024"), true);
  assert.equal(isValidCustomerPassword("senha12"), false);
  assert.equal(isValidCustomerPassword("senha"), false);
  assert.equal(isValidCustomerPassword("12345678"), false);
});
