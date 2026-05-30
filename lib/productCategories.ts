export const PRODUCT_CATEGORY_VALUES = ["BEVERAGE", "SHELF", "OTHER"] as const;

export type ProductCategoryValue = (typeof PRODUCT_CATEGORY_VALUES)[number];

export const PRODUCT_CATEGORY_OPTIONS: Array<{
  value: ProductCategoryValue;
  label: string;
}> = [
  { value: "BEVERAGE", label: "Bebida" },
  { value: "SHELF", label: "Produto de prateleira" },
  { value: "OTHER", label: "Outro" },
];

export function isProductCategoryValue(value: string): value is ProductCategoryValue {
  return PRODUCT_CATEGORY_VALUES.includes(value as ProductCategoryValue);
}

export function getProductCategoryLabel(category: string) {
  const match = PRODUCT_CATEGORY_OPTIONS.find((option) => option.value === category);
  return match?.label || "Outro";
}
