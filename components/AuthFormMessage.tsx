"use client";

import FeedbackMessage from "@/components/FeedbackMessage";

export default function AuthFormMessage({
  message,
}: {
  message: string | null;
}) {
  return <FeedbackMessage message={message} tone="error" />;
}
