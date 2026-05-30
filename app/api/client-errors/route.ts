import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  rateLimitResponse,
  readJsonWithLimit,
} from "@/lib/security";

type ClientErrorPayload = {
  message?: string;
  stack?: string;
  digest?: string;
  path?: string;
  userAgent?: string;
  source?: string;
};

function clamp(value: string | undefined, maxLength: number) {
  return typeof value === "string" ? value.slice(0, maxLength) : null;
}

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit({
    scope: "client_errors",
    identifier: request.headers.get("user-agent") || "unknown",
    limit: 60,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse();
  }

  let payload: ClientErrorPayload = {};

  try {
    payload = await readJsonWithLimit<ClientErrorPayload>(request, 4 * 1024);
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ ok: false }, { status: 413 });
    }

    payload = { message: "Invalid client error payload" };
  }

  console.error(
    "[client-error]",
    JSON.stringify({
      at: new Date().toISOString(),
      source: clamp(payload.source, 80) || "unknown",
      path: clamp(payload.path, 200),
      message: clamp(payload.message, 300),
      digest: clamp(payload.digest, 120),
      stack: clamp(payload.stack, 1000),
      userAgent: clamp(payload.userAgent, 200),
    })
  );

  return NextResponse.json({ ok: true });
}
