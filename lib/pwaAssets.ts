export const PEDRO_ROCHA_PWA_VERSION = "20260531-logo3";
export const PEDRO_ROCHA_APP_NAME = "Pedro Rocha Barbearia";
export const PEDRO_ROCHA_THEME_COLOR = "#080807";
export const PEDRO_ROCHA_BACKGROUND_COLOR = "#080807";

function versioned(path: string) {
  return `${path}?v=${PEDRO_ROCHA_PWA_VERSION}`;
}

export const PEDRO_ROCHA_FAVICON_PATH = versioned(
  "/brands/pedro-rocha/favicon.png"
);
export const PEDRO_ROCHA_APPLE_TOUCH_ICON_PATH = versioned(
  "/brands/pedro-rocha/apple-touch-icon.png"
);
export const PEDRO_ROCHA_ICON_192_PATH = versioned(
  "/brands/pedro-rocha/icon-192.png"
);
export const PEDRO_ROCHA_ICON_512_PATH = versioned(
  "/brands/pedro-rocha/icon-512.png"
);
export const PEDRO_ROCHA_MASKABLE_ICON_512_PATH = versioned(
  "/pwa/pedro-rocha/icon-maskable-512.png"
);
export const PEDRO_ROCHA_STARTUP_IMAGES = [
  {
    url: versioned("/pwa/pedro-rocha/splash-640x1136.png"),
    media:
      "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-750x1334.png"),
    media:
      "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-828x1792.png"),
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-1125x2436.png"),
    media:
      "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-1170x2532.png"),
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-1179x2556.png"),
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-1242x2688.png"),
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-1284x2778.png"),
    media:
      "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-1290x2796.png"),
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-1536x2048.png"),
    media:
      "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-1668x2224.png"),
    media:
      "(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-1668x2388.png"),
    media:
      "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: versioned("/pwa/pedro-rocha/splash-2048x2732.png"),
    media:
      "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
  },
];
