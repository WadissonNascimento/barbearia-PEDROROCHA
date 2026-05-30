"use client";

import { useFormStatus } from "react-dom";

type Props = {
  idleText: string;
  loadingText: string;
  className?: string;
};

const defaultClassName =
  "w-full rounded-2xl bg-[var(--brand)] px-6 py-4 font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70";

export default function SubmitButton({
  idleText,
  loadingText,
  className,
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className || defaultClassName}
    >
      {pending ? loadingText : idleText}
    </button>
  );
}
