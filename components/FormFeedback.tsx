"use client";

import FeedbackMessage from "@/components/FeedbackMessage";

export default function FormFeedback({
  error,
  success,
  info,
}: {
  error?: string | null;
  success?: string | null;
  info?: string | null;
}) {
  return (
    <div className="space-y-3">
      <FeedbackMessage message={error ?? null} tone="error" />
      <FeedbackMessage message={success ?? null} tone="success" />
      <FeedbackMessage message={info ?? null} tone="info" />
    </div>
  );
}
