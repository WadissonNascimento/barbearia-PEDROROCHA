"use client";

type FeedbackTone = "error" | "success" | "info";

const toneClasses: Record<FeedbackTone, string> = {
  error: "border-red-500/30 bg-red-500/10 text-red-100",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-100",
};

export default function FeedbackMessage({
  message,
  tone = "error",
}: {
  message: string | null;
  tone?: FeedbackTone;
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${toneClasses[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
