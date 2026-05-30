"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import { generateBarberPayoutsAction } from "./actions";

type FinanceFilters = {
  period: string;
  start: string;
  end: string;
  historyStart: string;
  historyEnd: string;
  compareMode: string;
  compareStart: string;
  compareEnd: string;
};

export default function GeneratePayoutsButton({
  filters,
}: {
  filters: FinanceFilters;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <FeedbackMessage message={feedback.message} tone={feedback.tone} />
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const formData = new FormData();
          Object.entries(filters).forEach(([key, value]) => {
            if (value) {
              formData.set(key, value);
            }
          });

          startTransition(async () => {
            const result = await generateBarberPayoutsAction(formData);
            setFeedback({ message: result.message, tone: result.tone });

            if (result.ok) {
              router.refresh();
            }
          });
        }}
        className="btn-primary"
      >
        {isPending ? "Salvando..." : "Salvar repasses"}
      </button>
    </div>
  );
}
