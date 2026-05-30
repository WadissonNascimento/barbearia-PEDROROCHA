"use client";

import { useEffect } from "react";
import {
  BRAZILIAN_PHONE_EXAMPLE,
  isValidBrazilianPhone,
  maskBrazilianPhone,
  normalizeBrazilianPhoneForSubmit,
} from "@/lib/phone";
import {
  sanitizeEmailInput,
  sanitizeSearchInput,
  sanitizeTextInput,
  sanitizeTextareaInput,
} from "@/lib/inputSanitization";

const RELOAD_FLAG = "jakbarber-runtime-reload";
const GLOBAL_ERROR_RELOAD_FLAG = "jakbarber-global-error-reload-v2";

function getErrorMessage(event: ErrorEvent | PromiseRejectionEvent) {
  if ("reason" in event) {
    const reason = event.reason;
    if (reason instanceof Error) return `${reason.name} ${reason.message}`;
    return String(reason || "");
  }

  return `${event.message || ""} ${event.error?.message || ""}`;
}

function isRecoverableChunkError(message: string) {
  return /ChunkLoadError|Loading chunk|failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    message
  );
}

function reportRuntimeError(message: string) {
  const payload = JSON.stringify({
    source: "runtime-guard",
    path: window.location.href,
    message,
    userAgent: window.navigator.userAgent,
  });

  try {
    if (window.navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      window.navigator.sendBeacon("/api/client-errors", blob);
      return;
    }
  } catch {
    // Fall back to fetch below.
  }

  fetch("/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

function isTextLikeInput(element: Element): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false;

  return [
    "email",
    "number",
    "password",
    "search",
    "tel",
    "text",
    "url",
  ].includes(element.type);
}

function isPhoneInput(element: HTMLInputElement) {
  const marker = `${element.name} ${element.id} ${element.placeholder}`.toLowerCase();

  if (
    element.type === "search" ||
    marker.includes("search") ||
    marker.includes("busca") ||
    marker.includes("buscar")
  ) {
    return false;
  }

  return element.type === "tel" || marker.includes("phone") || marker.includes("telefone");
}

function defaultMaxLength(element: HTMLInputElement | HTMLTextAreaElement) {
  if (element.maxLength > 0) return element.maxLength;
  if (element instanceof HTMLTextAreaElement) return 500;
  if (element.type === "email") return 254;
  if (element.type === "password") return 128;
  if (element.type === "search") return 120;
  if (element.type === "url") return 2048;
  return 180;
}

function hardenInputElement(element: HTMLInputElement | HTMLTextAreaElement) {
  if (element.dataset.inputHardened === "1") return;
  element.dataset.inputHardened = "1";

  if (element.maxLength < 0 || element.maxLength > defaultMaxLength(element)) {
    element.maxLength = defaultMaxLength(element);
  }

  if (element instanceof HTMLInputElement && isPhoneInput(element)) {
    element.type = "tel";
    element.inputMode = "numeric";
    element.autocomplete = element.autocomplete || "tel-national";
    element.maxLength = 15;
    element.placeholder = element.placeholder || BRAZILIAN_PHONE_EXAMPLE;
    element.pattern = "\\([1-9][0-9]\\) 9[0-9]{4}-[0-9]{4}";
  }
}

function sanitizeInputElement(element: HTMLInputElement | HTMLTextAreaElement) {
  hardenInputElement(element);

  if (element instanceof HTMLInputElement && isPhoneInput(element)) {
    if (!element.value.trim()) {
      element.setCustomValidity(element.required ? `Informe o telefone no formato ${BRAZILIAN_PHONE_EXAMPLE}.` : "");
      return;
    }

    const normalizedPhone = normalizeBrazilianPhoneForSubmit(element.value);
    element.value = normalizedPhone || maskBrazilianPhone(element.value);
    element.setCustomValidity(
      isValidBrazilianPhone(element.value)
        ? ""
        : `Use um telefone brasileiro valido no formato ${BRAZILIAN_PHONE_EXAMPLE}.`
    );
    return;
  }

  if (element instanceof HTMLInputElement) {
    if (element.type === "password" || element.type === "number") {
      element.value = element.value.trim().slice(0, defaultMaxLength(element));
      return;
    }

    if (element.type === "email") {
      element.value = sanitizeEmailInput(element.value);
      return;
    }

    if (element.type === "search") {
      element.value = sanitizeSearchInput(element.value);
      return;
    }

    element.value = sanitizeTextInput(element.value, {
      maxLength: defaultMaxLength(element),
    });
    return;
  }

  element.value = sanitizeTextareaInput(element.value, defaultMaxLength(element));
}

export default function ClientRuntimeGuard() {
  useEffect(() => {
    const clearReloadFlag = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(RELOAD_FLAG);
        window.sessionStorage.removeItem(GLOBAL_ERROR_RELOAD_FLAG);
      } catch {
        // Storage can be unavailable in some private mobile sessions.
      }
    }, 10000);

    function recoverFromStaleRuntime(event: ErrorEvent | PromiseRejectionEvent) {
      const message = getErrorMessage(event);
      if (!isRecoverableChunkError(message)) return;
      reportRuntimeError(message);

      try {
        if (window.sessionStorage.getItem(RELOAD_FLAG) === "1") return;
        window.sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        // If sessionStorage is blocked, a single reload is still better than a dead screen.
      }

      window.location.reload();
    }

    window.addEventListener("error", recoverFromStaleRuntime);
    window.addEventListener("unhandledrejection", recoverFromStaleRuntime);

    function handleFocusIn(event: FocusEvent) {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || isTextLikeInput(target as Element)) {
        hardenInputElement(target as HTMLInputElement | HTMLTextAreaElement);
      }
    }

    function handleInput(event: Event) {
      const target = event.target;
      if (target instanceof HTMLInputElement && isPhoneInput(target)) {
        target.value = maskBrazilianPhone(target.value);
        target.setCustomValidity("");
      }
    }

    function handleBlur(event: FocusEvent) {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || isTextLikeInput(target as Element)) {
        sanitizeInputElement(target as HTMLInputElement | HTMLTextAreaElement);
      }
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const fields = Array.from(form.elements).filter(
        (element): element is HTMLInputElement | HTMLTextAreaElement =>
          element instanceof HTMLTextAreaElement || isTextLikeInput(element)
      );

      for (const field of fields) {
        sanitizeInputElement(field);

        if (!field.checkValidity()) {
          event.preventDefault();
          field.reportValidity();
          return;
        }
      }
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("input", handleInput);
    document.addEventListener("blur", handleBlur, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      window.clearTimeout(clearReloadFlag);
      window.removeEventListener("error", recoverFromStaleRuntime);
      window.removeEventListener("unhandledrejection", recoverFromStaleRuntime);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("blur", handleBlur, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
