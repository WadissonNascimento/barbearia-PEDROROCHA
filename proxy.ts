import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";
import { getPostLoginRedirect } from "@/lib/authRedirect";

const { auth } = NextAuth(authConfig);
const SHOP_ADMIN_ROLES = ["ADMIN", "SHOP_ADMIN"];

function isShopAdminRole(role?: string | null) {
  return SHOP_ADMIN_ROLES.includes(role || "");
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  const role = req.auth?.user?.role;
  const isHomePage = pathname === "/";

  if (
    pathname === "/admin/produtos" ||
    pathname.startsWith("/admin/produtos/")
  ) {
    const nextUrl = req.nextUrl.clone();
    nextUrl.pathname = pathname.replace("/admin/produtos", "/admin/maquinas");
    return NextResponse.redirect(nextUrl);
  }

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/login/submit" ||
    pathname === "/admin/login" ||
    pathname === "/admin/login/submit" ||
    pathname === "/cadastro" ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/");
  const isPainelRoot = pathname === "/painel";
  const isCustomerProtectedPage =
    pathname.startsWith("/customer") ||
    pathname.startsWith("/agendar") ||
    pathname.startsWith("/meu-perfil") ||
    pathname.startsWith("/meus-pedidos");

  if (
    !isLoggedIn &&
    (pathname.startsWith("/painel") ||
      (pathname.startsWith("/admin") && !isAuthPage) ||
      pathname.startsWith("/barber") ||
      isCustomerProtectedPage)
  ) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "redirectTo",
      `${pathname}${req.nextUrl.search}`
    );

    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(
      new URL(getPostLoginRedirect(role), req.url)
    );
  }

  if (
    isLoggedIn &&
    (isPainelRoot || isHomePage) &&
    (isShopAdminRole(role) || role === "BARBER")
  ) {
    return NextResponse.redirect(
      new URL(getPostLoginRedirect(role), req.url)
    );
  }

  if (pathname.startsWith("/admin") && !isAuthPage && !isShopAdminRole(role)) {
    return NextResponse.redirect(new URL("/painel", req.url));
  }

  if (
    pathname.startsWith("/barber") &&
    role !== "BARBER" &&
    !isShopAdminRole(role)
  ) {
    return NextResponse.redirect(new URL("/painel", req.url));
  }

  if (isCustomerProtectedPage && role !== "CUSTOMER") {
    return NextResponse.redirect(new URL("/painel", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/",
    "/login",
    "/login/:path*",
    "/cadastro",
    "/register",
    "/register/:path*",
    "/forgot-password",
    "/forgot-password/:path*",
    "/painel/:path*",
    "/admin/:path*",
    "/barber/:path*",
    "/customer/:path*",
    "/agendar/:path*",
    "/meu-perfil/:path*",
    "/meus-pedidos/:path*",
  ],
};
