import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 60 * 1000;

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("Missing auth secret for registration auto-login.");
  }

  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createRegistrationAutoLoginToken(userId: string) {
  const issuedAt = Date.now().toString();
  const payload = `${userId}.${issuedAt}`;

  return `${payload}.${signPayload(payload)}`;
}

export function verifyRegistrationAutoLoginToken(userId: string, token: string) {
  const [tokenUserId, issuedAt, signature] = token.split(".");

  if (!tokenUserId || !issuedAt || !signature || tokenUserId !== userId) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);

  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > TOKEN_TTL_MS) {
    return false;
  }

  const payload = `${tokenUserId}.${issuedAt}`;
  const expectedSignature = signPayload(payload);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);

  return expected.length === received.length && timingSafeEqual(expected, received);
}
