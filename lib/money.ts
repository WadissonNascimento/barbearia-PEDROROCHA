export type MoneyValue =
  | number
  | string
  | null
  | undefined
  | {
      toNumber: () => number;
    };

export function toMoneyNumber(value: MoneyValue) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value.toNumber === "function") {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function roundMoney(value: MoneyValue) {
  return Number(toMoneyNumber(value).toFixed(2));
}
