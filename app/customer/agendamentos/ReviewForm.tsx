"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import CrownRating from "@/components/ui/CrownRating";
import { sanitizeTextareaInput } from "@/lib/inputSanitization";
import { submitAppointmentReviewAction } from "./actions";

const REVIEW_COMMENT_MAX_LENGTH = 50;

export default function ReviewForm({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="dashboard-subpanel mt-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (rating < 1) {
          setFeedback({ message: "Escolha uma nota de 1 a 5.", tone: "error" });
          return;
        }

        const formData = new FormData(event.currentTarget);
        formData.set(
          "comment",
          sanitizeTextareaInput(comment, REVIEW_COMMENT_MAX_LENGTH)
        );

        startTransition(async () => {
          const result = await submitAppointmentReviewAction(formData);
          setFeedback({ message: result.message, tone: result.tone });

          if (result.ok) {
            router.refresh();
          }
        });
      }}
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="rating" value={rating} />

      <div className="mb-3">
        <p className="text-sm font-semibold text-white">
          Como foi seu atendimento?
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Sua avaliação pode aparecer na página inicial da barbearia.
        </p>
      </div>

      <CrownRating
        rating={rating}
        size="lg"
        interactive
        disabled={isPending}
        onSelect={setRating}
      />

      <label className="mt-3 block">
        <span className="mb-2 block text-sm text-zinc-300">Comentario</span>
        <textarea
          name="comment"
          value={comment}
          onChange={(event) =>
            setComment(event.target.value.slice(0, REVIEW_COMMENT_MAX_LENGTH))
          }
          rows={3}
          maxLength={REVIEW_COMMENT_MAX_LENGTH}
          disabled={isPending}
          placeholder="Conte como foi o atendimento..."
          className="form-control resize-none text-sm"
        />
        <span className="mt-1 block text-right text-xs text-zinc-500">
          {comment.length}/{REVIEW_COMMENT_MAX_LENGTH}
        </span>
      </label>

      <div className="mt-3">
        <FeedbackMessage message={feedback.message} tone={feedback.tone} />
      </div>

      <button
        type="submit"
        disabled={isPending || rating < 1}
        className="btn-primary mt-3 w-full sm:w-auto"
      >
        {isPending
          ? "Salvando..."
          : "Enviar avaliação"}
      </button>
    </form>
  );
}
