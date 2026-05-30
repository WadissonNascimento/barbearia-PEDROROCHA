"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Clock,
  CreditCard,
  Home,
  Landmark,
  LogIn,
  Menu,
  MessageSquareText,
  Scissors,
  Settings,
  ShoppingBag,
  Store,
  UserPlus,
  Users,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useId, useRef } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { JAKBARBER_PWA_VERSION } from "@/lib/pwaAssets";

type HeaderRole = "ADMIN" | "SHOP_ADMIN" | "BARBER" | "CUSTOMER" | null;

type NavLink = {
  href: string;
  label: string;
};

function getHeaderLinks(role: HeaderRole): {
  homeHref: string;
  eyebrow: string;
  primary: NavLink[];
  secondary: NavLink[];
} {
  if (role === "ADMIN" || role === "SHOP_ADMIN") {
    return {
      homeHref: "/admin",
      eyebrow: "Admin",
      primary: [
        { href: "/admin", label: "Inicio" },
        { href: "/admin/agenda", label: "Agenda geral" },
        { href: "/admin/barbeiros", label: "Equipe" },
        { href: "/admin/financeiro", label: "Financeiro" },
      ],
      secondary: [
        { href: "/admin/servicos", label: "Servicos" },
        { href: "/admin/extras", label: "Extras" },
        { href: "/admin/maquinas", label: "Maquinas" },
      ],
    };
  }

  if (role === "BARBER") {
    return {
      homeHref: "/barber",
      eyebrow: "Barbeiro",
      primary: [
        { href: "/barber", label: "Hoje" },
        { href: "/barber/agenda", label: "Agenda" },
        { href: "/barber/clientes", label: "Clientes" },
        { href: "/barber/disponibilidade", label: "Pausas" },
      ],
      secondary: [{ href: "/barber?notifications=1", label: "Notificacoes" }],
    };
  }

  if (role === "CUSTOMER") {
    return {
      homeHref: "/",
      eyebrow: "Cliente",
      primary: [
        { href: "/agendar", label: "Agendar" },
        { href: "/customer/agendamentos", label: "Meus horários" },
        { href: "/maquinas", label: "Maquinas" },
      ],
      secondary: [
        { href: "/customer/notificacoes", label: "Notificacoes" },
        { href: "/meu-perfil", label: "Meu perfil" },
      ],
    };
  }

  return {
    homeHref: "/",
    eyebrow: "Barbearia",
    primary: [
      { href: "/agendar", label: "Agendar" },
      { href: "/servicos", label: "Serviços" },
      { href: "/maquinas", label: "Maquinas" },
      { href: "/login", label: "Entrar" },
    ],
    secondary: [{ href: "/register", label: "Criar conta" }],
  };
}

function isActivePath(pathname: string, href: string) {
  if (["/", "/admin", "/barber"].includes(href)) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

const navIcons: Record<string, LucideIcon> = {
  "/": Home,
  "/admin": Home,
  "/admin/agenda": CalendarDays,
  "/admin/avaliacoes": MessageSquareText,
  "/admin/barbeiros": Users,
  "/admin/configuracoes": Settings,
  "/admin/extras": ShoppingBag,
  "/admin/financeiro": Landmark,
  "/admin/maquinas": Store,
  "/admin?notifications=1": Bell,
  "/admin/perfil": UserRound,
  "/admin/servicos": Scissors,
  "/agendar": CalendarDays,
  "/barber": Clock,
  "/barber/agenda": CalendarDays,
  "/barber/clientes": Users,
  "/barber/disponibilidade": Clock,
  "/barber?notifications=1": Bell,
  "/barber/servicos": Scissors,
  "/customer/agendamentos": CalendarDays,
  "/customer/notificacoes": Bell,
  "/login": LogIn,
  "/meu-perfil": UserRound,
  "/maquinas": ShoppingBag,
  "/register": UserPlus,
  "/servicos": Scissors,
};

function NavItemIcon({ href, className }: { href: string; className?: string }) {
  const Icon = navIcons[href] || CreditCard;

  return <Icon aria-hidden="true" className={className} strokeWidth={2.1} />;
}

export default function Header({
  shopId,
  brandName,
  logoPath,
  publicEyebrow,
  role,
  userName,
}: {
  shopId: string;
  brandName: string;
  logoPath: string;
  publicEyebrow: string;
  role: HeaderRole;
  userName?: string | null;
}) {
  const pathname = usePathname() || "";
  const nav = getHeaderLinks(role);
  const eyebrow = role ? nav.eyebrow : publicEyebrow;
  const menuToggleId = useId();
  const menuToggleRef = useRef<HTMLInputElement | null>(null);
  const isJakBarber = shopId === "shop_jak_barber";
  const headerInnerClass = isJakBarber
    ? "mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-6 sm:py-6"
    : "mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6";
  const logoClassName = isJakBarber
    ? "h-auto w-[132px] object-contain sm:w-[148px]"
    : "h-auto w-[108px] object-contain sm:w-[120px]";
  const logoSrc =
    isJakBarber && logoPath === "/logo.png"
      ? `${logoPath}?v=${JAKBARBER_PWA_VERSION}`
      : logoPath;
  const logoWidth = isJakBarber ? 960 : 640;
  const logoHeight = isJakBarber ? 540 : 179;
  const menuButtonClassName = `group fixed right-4 ${
    isJakBarber ? "top-5 h-14 w-14 rounded-[1.35rem]" : "top-3 h-12 w-12 rounded-2xl"
  } z-[130] flex cursor-pointer items-center justify-center border border-[var(--site-header-control-border)] bg-[var(--site-header-control-bg)] text-[var(--site-header-control-text)] transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand-muted)] active:scale-95 md:relative md:right-auto md:top-auto md:z-auto`;
  const closeButtonClassName = `pointer-events-none fixed right-4 ${
    isJakBarber ? "top-5 h-14 w-14 rounded-[1.35rem]" : "top-3 h-12 w-12 rounded-2xl"
  } z-[160] flex cursor-pointer items-center justify-center border border-[var(--site-header-control-border)] bg-[var(--site-header-control-bg)] text-[var(--site-header-control-text)] opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand-muted)] active:scale-95 peer-checked:pointer-events-auto peer-checked:opacity-100 sm:right-6`;
  const menuPanelClassName = `pointer-events-none fixed left-3 right-3 ${
    isJakBarber ? "top-[96px] sm:top-[108px]" : "top-[76px] sm:top-[84px]"
  } z-[170] max-w-[calc(100vw-1.5rem)] translate-y-2 rounded-3xl border border-[var(--site-header-border)] bg-[var(--site-header-bg)] p-3 opacity-0 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition duration-200 peer-checked:pointer-events-auto peer-checked:translate-y-0 peer-checked:opacity-100 sm:left-auto sm:right-4 sm:w-[320px]`;

  function closeMenu() {
    if (menuToggleRef.current) {
      menuToggleRef.current.checked = false;
    }
  }

  return (
    <>
      <input
        ref={menuToggleRef}
        id={menuToggleId}
        type="checkbox"
        className="peer sr-only"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-[100] w-full max-w-full overflow-hidden border-b border-[var(--site-header-border)] bg-[var(--site-header-bg)] backdrop-blur-2xl">
        <div className={headerInnerClass}>
          <Link href={nav.homeHref} className="flex min-w-0 items-center gap-3">
            {logoSrc ? (
              <Image
                src={logoSrc}
                alt={brandName}
                width={logoWidth}
                height={logoHeight}
                className={logoClassName}
                priority
                unoptimized
              />
            ) : (
              <span className="max-w-[160px] truncate text-lg font-bold text-[var(--site-header-text)]">
                {brandName}
              </span>
            )}
            {role ? (
              <span className="hidden max-w-[150px] truncate text-xs text-[var(--site-header-muted)] sm:inline">
                {userName || eyebrow}
              </span>
            ) : null}
          </Link>

          <div className="flex items-center gap-3">
            {role !== "CUSTOMER" ? (
              <nav className="hidden items-center gap-2 md:flex">
                {nav.primary.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                      isActivePath(pathname, link.href)
                        ? "bg-[var(--brand-muted)] text-[var(--site-header-active-text)]"
                        : "text-[var(--site-header-link)] hover:bg-[var(--site-header-control-bg)] hover:text-[var(--site-header-link-hover)]"
                    }`}
                  >
                    <NavItemIcon href={link.href} className="h-4 w-4 shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                ))}
              </nav>
            ) : null}

            <div className="relative">
              <label
                htmlFor={menuToggleId}
                aria-label="Abrir menu"
                className={menuButtonClassName}
                style={{
                  borderColor: "var(--site-header-control-border)",
                  background: "var(--site-header-control-bg)",
                  color: "var(--site-header-control-text)",
                }}
              >
                <Menu
                  aria-hidden="true"
                  className="h-6 w-6"
                  strokeWidth={2.4}
                  style={{ color: "var(--site-header-control-text)" }}
                />
              </label>
            </div>
          </div>
        </div>
      </header>

      <label
        htmlFor={menuToggleId}
        aria-label="Fechar menu"
        className="pointer-events-none fixed inset-0 z-[140] cursor-pointer bg-black/45 opacity-0 backdrop-blur-[2px] transition peer-checked:pointer-events-auto peer-checked:opacity-100"
      />

      <label
        htmlFor={menuToggleId}
        aria-label="Fechar menu"
        className={closeButtonClassName}
      >
        <span className="absolute h-[2px] w-5 translate-y-0 rotate-45 rounded-full bg-current" />
        <span className="absolute h-[2px] w-5 translate-y-0 -rotate-45 rounded-full bg-current" />
      </label>

      <div
        className={menuPanelClassName}
      >
        <div className="mb-3 flex items-center justify-between border-b border-[var(--site-header-border)] pb-3">
          <p className="text-sm font-semibold text-[var(--site-header-text)]">Menu</p>
          <div className="rounded-full border border-[var(--site-header-border)] bg-[var(--site-header-control-bg)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--brand-strong)]">
            {eyebrow}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2">
            {nav.primary.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className={`flex w-full items-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                  isActivePath(pathname, link.href)
                    ? "bg-[var(--brand)] text-white shadow-[0_12px_24px_rgba(0,0,0,0.28)]"
                    : "border border-white/10 bg-white/[0.04] text-white hover:border-[var(--brand)]/40 hover:bg-[var(--brand-muted)]"
                }`}
              >
                <NavItemIcon href={link.href} className="h-5 w-5 shrink-0" />
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          <div className="grid gap-2 border-t border-white/10 pt-3">
            {nav.secondary.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand-muted)] active:scale-[0.98]"
              >
                <NavItemIcon href={link.href} className="h-5 w-5 shrink-0" />
                <span>{link.label}</span>
              </Link>
            ))}
            {role ? (
              <div className="pt-1" onClick={closeMenu}>
                <LogoutButton />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
