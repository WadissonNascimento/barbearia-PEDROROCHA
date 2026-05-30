const SCRIPT_TAG_PATTERN = /<\s*\/?\s*script\b[^>]*>/gi;
const SCRIPT_BLOCK_PATTERN = /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const JAVASCRIPT_URL_PATTERN = /javascript\s*:/gi;
const EVENT_HANDLER_PATTERN = /\son[a-z]+\s*=/gi;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

type SanitizeOptions = {
  maxLength?: number;
  preserveLineBreaks?: boolean;
};

export function sanitizeTextInput(
  value: string | null | undefined,
  options: SanitizeOptions = {}
) {
  const maxLength = Math.max(0, options.maxLength ?? 180);
  const normalized = String(value || "")
    .replace(CONTROL_CHAR_PATTERN, "")
    .replace(SCRIPT_BLOCK_PATTERN, "")
    .replace(SCRIPT_TAG_PATTERN, "")
    .replace(JAVASCRIPT_URL_PATTERN, "")
    .replace(EVENT_HANDLER_PATTERN, " ")
    .replace(/[<>]/g, "")
    .trim();
  const lineSafeValue = options.preserveLineBreaks
    ? normalized
    : normalized.replace(/\s+/g, " ");

  return lineSafeValue.slice(0, maxLength);
}

export function sanitizeEmailInput(value: string | null | undefined) {
  return sanitizeTextInput(value, { maxLength: 254 }).toLowerCase();
}

export function sanitizeSearchInput(value: string | null | undefined) {
  return sanitizeTextInput(value, { maxLength: 120 });
}

export function sanitizeTextareaInput(
  value: string | null | undefined,
  maxLength = 500
) {
  return sanitizeTextInput(value, { maxLength, preserveLineBreaks: true });
}
