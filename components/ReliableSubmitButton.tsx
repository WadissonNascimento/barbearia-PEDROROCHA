"use client";

import { useRef, useState } from "react";

type Props = {
  idleText: string;
  loadingText: string;
  className?: string;
};

const defaultClassName =
  "w-full rounded-2xl bg-[var(--brand)] px-6 py-4 font-semibold text-white shadow-[0_12px_30px_rgba(14,165,233,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70";

export default function ReliableSubmitButton({
  idleText,
  loadingText,
  className,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submittedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  async function submitNow() {
    if (submittedRef.current) return;

    const button = buttonRef.current;
    const form = button?.form;

    if (!button || !form) return;
    if (typeof form.reportValidity === "function" && !form.reportValidity()) {
      return;
    }

    submittedRef.current = true;
    setSubmitting(true);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const response = await fetch(form.action, {
        method: form.method || "post",
        body: new FormData(form),
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "X-Requested-With": "fetch",
        },
      });
      window.clearTimeout(timeout);
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = (await response.json()) as {
          error?: string;
          redirectTo?: string;
        };

        if (data.redirectTo) {
          window.location.assign(data.redirectTo);
          return;
        }
      }

      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }
    } catch {
      form.submit();
      return;
    }

    submittedRef.current = false;
    setSubmitting(false);
  }

  return (
    <button
      ref={buttonRef}
      type="submit"
      disabled={submitting}
      className={className || defaultClassName}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return;

        event.preventDefault();
        void submitNow();
      }}
      onClick={(event) => {
        event.preventDefault();
        void submitNow();
      }}
    >
      {submitting ? loadingText : idleText}
    </button>
  );
}
