export function getGoogleClientId() {
  return process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "";
}

export function getGoogleClientSecret() {
  return process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
}

export function isGoogleSignInConfigured() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}
