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
import { getTenantDesignTemplate } from "@/lib/tenantDesign";
import {
  DEFAULT_SHOP_ID,
  getCurrentShop,
  getRequestHost,
  getRequestPath,
  logTenantObservabilityEvent,
} from "@/lib/shop";
import {
  PEDRO_ROCHA_APP_NAME,
  PEDRO_ROCHA_APPLE_TOUCH_ICON_PATH,
  PEDRO_ROCHA_FAVICON_PATH,
  PEDRO_ROCHA_ICON_192_PATH,
  PEDRO_ROCHA_STARTUP_IMAGES,
  PEDRO_ROCHA_THEME_COLOR,
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
  const appName = PEDRO_ROCHA_APP_NAME;
  const description =
    shop.metadataDescription ||
    "Agende seu horario e acompanhe seus atendimentos com praticidade.";
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
    icons: {
      icon: [
        {
          url: PEDRO_ROCHA_FAVICON_PATH,
          sizes: "64x64",
          type: "image/png",
        },
        {
          url: PEDRO_ROCHA_ICON_192_PATH,
          sizes: "192x192",
          type: "image/png",
        },
      ],
      shortcut: [
        {
          url: PEDRO_ROCHA_FAVICON_PATH,
          type: "image/png",
        },
      ],
      apple: [
        {
          url: PEDRO_ROCHA_APPLE_TOUCH_ICON_PATH,
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    appleWebApp: {
      capable: true,
      title: appName,
      statusBarStyle: "black-translucent",
      startupImage: PEDRO_ROCHA_STARTUP_IMAGES,
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
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: PEDRO_ROCHA_THEME_COLOR,
    colorScheme: "dark",
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
  const backgroundColor = shop.backgroundColor || designTemplate.backgroundColor;
  const textColor = shop.textColor || designTemplate.textColor;
  const tenantBrandStyle: TenantBrandStyle = {
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
          "--tenant-font-family": "var(--font-body), sans-serif",
          "--tenant-heading-font-family": "var(--font-heading), sans-serif",
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
          locationUrl=""
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
