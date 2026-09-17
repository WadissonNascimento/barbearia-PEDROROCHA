import "server-only";

import { headers } from "next/headers";

export const LOCAL_BILLING_PREVIEW_HEADER = "x-local-billing-preview";
export const LOCAL_BILLING_PREVIEW_PATH = "/preview/planos";

export async function isLocalBillingPreviewRequest() {
  if (process.env.NODE_ENV !== "development") return false;

  const requestHeaders = await headers();
  return requestHeaders.get(LOCAL_BILLING_PREVIEW_HEADER) === LOCAL_BILLING_PREVIEW_PATH;
}
