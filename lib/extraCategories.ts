export const EXTRA_CATEGORY_VALUES = [
  "BEVERAGE",
  "SHELF",
  "OTHER",
] as const;

export type ExtraCategoryValue = (typeof EXTRA_CATEGORY_VALUES)[number];

export const EXTRA_CATEGORY_OPTIONS: Array<{
  value: ExtraCategoryValue;
  label: string;
}> = [
  { value: "BEVERAGE", label: "Bebida" },
  { value: "SHELF", label: "Produto de prateleira" },
  { value: "OTHER", label: "Outro" },
];

export function isExtraCategoryValue(value: string): value is ExtraCategoryValue {
  return EXTRA_CATEGORY_VALUES.includes(value as ExtraCategoryValue);
}

export function getExtraCategoryLabel(category: string) {
  return (
    EXTRA_CATEGORY_OPTIONS.find((option) => option.value === category)?.label || "Outro"
  );
}
