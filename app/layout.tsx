import "./globals.css";
import AppChrome from "@/components/AppChrome";
import AppVersionRefresh from "@/components/AppVersionRefresh";
import ClientRuntimeGuard from "@/components/ClientRuntimeGuard";
import PushNotificationManager from "@/components/PushNotificationManager";
import RequiredCustomerPhoneModal from "@/components/RequiredCustomerPhoneModal";
import { Manrope, Space_Grotesk } from "next/font/google";
import { auth } from "@/auth";
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { getConfiguredAppUrl } from "@/lib/appUrl";
import { prisma } from "@/lib/prisma";
import { getTenantDesignTemplate, getTenantFontStyle } from "@/lib/tenantDesign";
import {
  DEFAULT_SHOP_ID,
  getCurrentShop,
  getRequestHost,
  getRequestPath,
  logTenantObservabilityEvent,
} from "@/lib/shop";
import {
  JAKBARBER_APP_NAME,
  JAKBARBER_APPLE_TOUCH_ICON_PATH,
  JAKBARBER_BACKGROUND_COLOR,
  JAKBARBER_FAVICON_32_PATH,
  JAKBARBER_FAVICON_48_PATH,
  JAKBARBER_ICON_192_PATH,
  JAKBARBER_STARTUP_IMAGES,
  JAKBARBER_THEME_COLOR,
} from "@/lib/pwaAssets";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

type TenantBrandStyle = CSSProperties & Record<`--${string}`, string>;

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getCurrentShop();
  const brandName = shop.name || "Barbearia";
  const isJakBarber = shop.id === DEFAULT_SHOP_ID;
  const appName = isJakBarber ? JAKBARBER_APP_NAME : brandName;
  const description =
    shop.metadataDescription ||
    "Agende seu horario, acompanhe seus atendimentos e encontre maquinas para manter o cuidado em dia.";
  const faviconPath = isJakBarber
    ? JAKBARBER_FAVICON_32_PATH
    : shop.faviconPath || "";
  const title = shop.metadataTitle || brandName;

  return {
    metadataBase: new URL(getConfiguredAppUrl()),
    applicationName: appName,
    manifest: "/manifest.webmanifest",
    title: {
      default: title,
      template: "%s",
    },
    description,
    icons: isJakBarber
      ? {
          icon: [
            {
              url: JAKBARBER_FAVICON_32_PATH,
              sizes: "32x32",
              type: "image/png",
            },
            {
              url: JAKBARBER_FAVICON_48_PATH,
              sizes: "48x48",
              type: "image/png",
            },
            {
              url: JAKBARBER_ICON_192_PATH,
              sizes: "192x192",
              type: "image/png",
            },
          ],
          shortcut: [
            {
              url: JAKBARBER_FAVICON_32_PATH,
              type: "image/png",
            },
          ],
          apple: [
            {
              url: JAKBARBER_APPLE_TOUCH_ICON_PATH,
              sizes: "180x180",
              type: "image/png",
            },
          ],
        }
      : faviconPath
      ? {
          icon: [
            {
              url: faviconPath,
              sizes: "64x64",
              type: "image/png",
            },
          ],
          shortcut: [
            {
              url: faviconPath,
              type: "image/png",
            },
          ],
          apple: [
            {
              url: faviconPath,
              sizes: "180x180",
              type: "image/png",
            },
          ],
        }
      : undefined,
    appleWebApp: {
      capable: true,
      title: appName,
      statusBarStyle: isJakBarber ? "black-translucent" : "default",
      startupImage: isJakBarber ? JAKBARBER_STARTUP_IMAGES : undefined,
    },
    other: {
      "mobile-web-app-capable": "yes",
      "apple-mobile-web-app-title": appName,
    },
    openGraph: {
      title: brandName,
      description,
      url: "/",
      siteName: brandName,
      images: shop.logoPath
        ? [
            {
              url: shop.logoPath,
              width: 1200,
              height: 630,
              alt: brandName,
            },
          ]
        : undefined,
      locale: "pt_BR",
      type: "website",
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const shop = await getCurrentShop();
  const isJakBarber = shop.id === DEFAULT_SHOP_ID;

  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: isJakBarber
      ? JAKBARBER_THEME_COLOR
      : shop.brandColor || "#05070b",
    colorScheme: isJakBarber ? "dark" : "light dark",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const shop = await getCurrentShop();
  const role =
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "SHOP_ADMIN" ||
    session?.user?.role === "BARBER" ||
    session?.user?.role === "CUSTOMER"
      ? session.user.role
      : null;
  if (role && (!session?.user?.shopId || shop.id !== session.user.shopId)) {
    const [host, path] = await Promise.all([
      getRequestHost().catch(() => null),
      getRequestPath().catch(() => null),
    ]);

    logTenantObservabilityEvent({
      event: "tenant_session_shop_mismatch",
      host,
      path,
      resolvedShopId: shop.id,
      usedFallback: false,
      fallbackReason: session?.user?.shopId
        ? "session_shop_mismatch"
        : "session_shop_missing",
    });

    redirect("/logout");
  }

  const brandName = shop.name || "Barbearia";
  const logoPath = shop.logoPath || "";
  const designTemplate = getTenantDesignTemplate(shop.designTemplate);
  const tenantFont = getTenantFontStyle(shop.fontStyle);
  const backgroundColor = shop.backgroundColor || designTemplate.backgroundColor;
  const textColor = shop.textColor || designTemplate.textColor;
  const tenantBrandStyle: TenantBrandStyle =
    shop.id === "shop_rodrigo_style"
      ? {
          "--app-bg": backgroundColor,
          "--app-gradient-start": "#fafaf7",
          "--app-gradient-mid": backgroundColor,
          "--app-gradient-end": "#efe7d8",
          "--panel-bg": "#ffffff",
          "--panel-bg-strong": "#ffffff",
          "--panel-border": "#e6dfd2",
          "--surface-soft": "rgba(255, 255, 255, 0.76)",
          "--text-primary": textColor,
          "--text-secondary": "#5f5f5f",
          "--text-muted": "#767064",
          "--brand": shop.brandColor || designTemplate.brandColor,
          "--brand-strong": "#0b0b0b",
          "--brand-muted": "rgba(201, 151, 43, 0.16)",
          "--tenant-font-family": tenantFont.cssFamily,
          "--tenant-heading-font-family": tenantFont.cssFamily,
          "--site-header-bg": "rgba(255, 255, 255, 0.96)",
          "--site-header-border": "#e6dfd2",
          "--site-header-text": "#0b0b0b",
          "--site-header-muted": "#5f5f5f",
          "--site-header-link": "#222222",
          "--site-header-link-hover": "#0b0b0b",
          "--site-header-active-text": "#0b0b0b",
          "--site-header-control-bg": "#ffffff",
          "--site-header-control-border": "#d8cfbf",
          "--site-header-control-text": "#0b0b0b",
        }
      : shop.id === "shop_pedro_rocha_barbearia"
      ? {
          "--app-bg": backgroundColor,
          "--app-gradient-start": "#11100f",
          "--app-gradient-mid": "#080807",
          "--app-gradient-end": "#020202",
          "--panel-bg": "rgba(255, 255, 255, 0.04)",
          "--panel-bg-strong": "rgba(255, 255, 255, 0.055)",
          "--panel-border": "rgba(241, 232, 216, 0.14)",
          "--surface-soft": "rgba(241, 232, 216, 0.06)",
          "--text-primary": textColor,
          "--text-secondary": "#c9c0b2",
          "--text-muted": "#8f887d",
          "--brand": shop.brandColor || "#24211d",
          "--brand-strong": shop.brandColorStrong || "#f1e8d8",
          "--brand-muted": shop.brandColorMuted || "rgba(241, 232, 216, 0.08)",
          "--tenant-font-family": tenantFont.cssFamily,
          "--tenant-heading-font-family": tenantFont.cssFamily,
          "--site-header-bg": "rgba(8, 8, 7, 0.96)",
          "--site-header-border": "rgba(241, 232, 216, 0.12)",
          "--site-header-text": "#f5efe3",
          "--site-header-muted": "#bcb3a5",
          "--site-header-link": "#ded4c4",
          "--site-header-link-hover": "#ffffff",
          "--site-header-active-text": "#f5efe3",
          "--site-header-control-bg": "rgba(255, 255, 255, 0.045)",
          "--site-header-control-border": "rgba(241, 232, 216, 0.16)",
          "--site-header-control-text": "#f5efe3",
        }
      : {
          "--app-bg": backgroundColor,
          "--app-gradient-start": backgroundColor,
          "--app-gradient-mid": backgroundColor,
          "--app-gradient-end": "#030712",
          "--text-primary": textColor,
          "--text-secondary": textColor,
          "--brand": shop.brandColor || "#14b8a6",
          "--brand-strong": shop.brandColorStrong || "#99f6e4",
          "--brand-muted": shop.brandColorMuted || "rgba(20, 184, 166, 0.18)",
          "--tenant-font-family": tenantFont.cssFamily,
          "--tenant-heading-font-family": tenantFont.cssFamily,
        };
  const customerPhone =
    role === "CUSTOMER" && session?.user?.id
      ? (
          await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { phone: true },
          })
        )?.phone || null
      : null;
  const shouldCompleteCustomerPhone = role === "CUSTOMER" && !customerPhone;

  return (
    <html lang="pt-BR">
      <body
        className={`${bodyFont.variable} ${headingFont.variable} min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)]`}
        data-shop-id={shop.id}
        style={tenantBrandStyle}
      >
        <ClientRuntimeGuard />
        <AppVersionRefresh />
        <AppChrome
          shopId={shop.id}
          brandName={brandName}
          logoPath={logoPath}
          publicEyebrow={brandName}
          role={role}
          userName={session?.user?.name || null}
          whatsappNumber={shop.whatsappNumber || ""}
          instagramUrl={shop.instagramUrl || ""}
          addressLine={shop.addressLine || ""}
          locationUrl={
            shop.id === DEFAULT_SHOP_ID
              ? "https://www.google.com/maps?ftid=0x94cefd02794bf5e3:0xd23868a9ee010185"
              : ""
          }
          businessHours={shop.businessHours || "Horario sob consulta"}
        >
          {children}
        </AppChrome>
        {shouldCompleteCustomerPhone ? <RequiredCustomerPhoneModal /> : null}
        {role ? (
          <PushNotificationManager
            publicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || null}
          />
        ) : null}
      </body>
    </html>
  );
}
