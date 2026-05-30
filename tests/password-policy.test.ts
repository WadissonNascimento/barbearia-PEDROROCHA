import assert from "node:assert/strict";
import test from "node:test";
import { isStrongPassword } from "../lib/passwordPolicy";

test("password recovery policy requires 8 characters, letters and a number", () => {
  assert.equal(isStrongPassword("senha123"), true);
  assert.equal(isStrongPassword("Cliente2024"), true);
  assert.equal(isStrongPassword("senha12"), false);
  assert.equal(isStrongPassword("senhasemnumero"), false);
  assert.equal(isStrongPassword("12345678"), false);
});
