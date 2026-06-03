import type { MetadataRoute } from "next";
import { getCurrentShop } from "@/lib/shop";
import {
  PEDRO_ROCHA_APP_NAME,
  PEDRO_ROCHA_BACKGROUND_COLOR,
  PEDRO_ROCHA_ICON_192_PATH,
  PEDRO_ROCHA_ICON_512_PATH,
  PEDRO_ROCHA_MASKABLE_ICON_512_PATH,
  PEDRO_ROCHA_THEME_COLOR,
} from "@/lib/pwaAssets";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const shop = await getCurrentShop();
  const appName = PEDRO_ROCHA_APP_NAME;

  return {
    name: appName,
    short_name: appName,
    description:
      shop.metadataDescription ||
      "Agende horarios e acompanhe seus atendimentos da barbearia.",
    id: shop.primaryDomain ? `https://${shop.primaryDomain}/` : "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PEDRO_ROCHA_BACKGROUND_COLOR,
    theme_color: PEDRO_ROCHA_THEME_COLOR,
    icons: [
      {
        src: PEDRO_ROCHA_ICON_192_PATH,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: PEDRO_ROCHA_ICON_512_PATH,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: PEDRO_ROCHA_MASKABLE_ICON_512_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
