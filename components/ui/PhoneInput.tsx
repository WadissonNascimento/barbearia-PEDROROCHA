"use client";

import {
  BRAZILIAN_PHONE_EXAMPLE,
  BRAZILIAN_PHONE_PATTERN,
  maskBrazilianPhone,
  normalizeBrazilianPhoneForSubmit,
} from "@/lib/phone";

type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "pattern"
>;

export default function PhoneInput({
  className = "form-control",
  defaultValue,
  value,
  onChange,
  onBlur,
  placeholder = BRAZILIAN_PHONE_EXAMPLE,
  ...props
}: PhoneInputProps) {
  const resolvedValue =
    value === undefined ? undefined : maskBrazilianPhone(String(value));

  return (
    <input
      {...props}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      maxLength={15}
      pattern={BRAZILIAN_PHONE_PATTERN}
      placeholder={placeholder}
      defaultValue={
        defaultValue === undefined ? undefined : maskBrazilianPhone(String(defaultValue))
      }
      value={resolvedValue}
      onChange={(event) => {
        event.currentTarget.value = maskBrazilianPhone(event.currentTarget.value);
        onChange?.(event);
      }}
      onBlur={(event) => {
        const normalized = normalizeBrazilianPhoneForSubmit(event.currentTarget.value);
        event.currentTarget.value = normalized || maskBrazilianPhone(event.currentTarget.value);
        onBlur?.(event);
      }}
      title={`Use o formato ${BRAZILIAN_PHONE_EXAMPLE}`}
      className={className}
    />
  );
}
