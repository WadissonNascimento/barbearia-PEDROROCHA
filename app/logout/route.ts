import { NextResponse } from "next/server";
import { getRequestAwareAppUrl } from "@/lib/appUrl";

const COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
];

export async function GET(request: Request) {
  const url = new URL(
    "/login",
    getRequestAwareAppUrl(request.url, request.headers)
  );
  const response = NextResponse.redirect(url, { status: 303 });
  response.headers.set("Cache-Control", "no-store");

  for (const name of COOKIE_NAMES) {
    response.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      maxAge: 0,
      path: "/",
      secure: name.startsWith("__Secure-") || name.startsWith("__Host-"),
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return response;
}
