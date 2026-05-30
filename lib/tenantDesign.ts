export type TenantDesignTemplate = "dark-premium" | "light-premium" | "urban" | "minimal";
export type TenantFontStyle = "modern" | "classic" | "bold";

export const TENANT_DESIGN_TEMPLATES: Array<{
  code: TenantDesignTemplate;
  name: string;
  backgroundColor: string;
  textColor: string;
  brandColor: string;
}> = [
  {
    code: "dark-premium",
    name: "Premium escuro",
    backgroundColor: "#030712",
    textColor: "#f6f7fb",
    brandColor: "#14b8a6",
  },
  {
    code: "light-premium",
    name: "Premium claro",
    backgroundColor: "#f8f5ef",
    textColor: "#111111",
    brandColor: "#c9972b",
  },
  {
    code: "urban",
    name: "Urbano",
    backgroundColor: "#08090d",
    textColor: "#f5f5f5",
    brandColor: "#a3e635",
  },
  {
    code: "minimal",
    name: "Minimalista",
    backgroundColor: "#f7f7f7",
    textColor: "#151515",
    brandColor: "#111827",
  },
];

export const TENANT_FONT_STYLES: Array<{
  code: TenantFontStyle;
  name: string;
  cssFamily: string;
}> = [
  {
    code: "modern",
    name: "Moderna",
    cssFamily: "var(--font-body), sans-serif",
  },
  {
    code: "classic",
    name: "Classica",
    cssFamily: "Georgia, serif",
  },
  {
    code: "bold",
    name: "Forte",
    cssFamily: "var(--font-heading), sans-serif",
  },
];

export function normalizeHexColor(value: string | null | undefined, fallback: string) {
  const trimmed = String(value || "").trim();

  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

export function getTenantDesignTemplate(value: string | null | undefined) {
  return (
    TENANT_DESIGN_TEMPLATES.find((template) => template.code === value) ||
    TENANT_DESIGN_TEMPLATES[0]
  );
}

export function getTenantFontStyle(value: string | null | undefined) {
  return TENANT_FONT_STYLES.find((font) => font.code === value) || TENANT_FONT_STYLES[0];
}

export function isTenantDesignTemplate(value: string): value is TenantDesignTemplate {
  return TENANT_DESIGN_TEMPLATES.some((template) => template.code === value);
}

export function isTenantFontStyle(value: string): value is TenantFontStyle {
  return TENANT_FONT_STYLES.some((font) => font.code === value);
}
