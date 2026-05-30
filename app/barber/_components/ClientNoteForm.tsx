"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import { saveClientNoteAction } from "../actions";

export function ClientNoteForm({
  customerId,
  initialNote,
  buttonClassName,
  rows = 5,
}: {
  customerId: string;
  initialNote: string;
  buttonClassName?: string;
  rows?: number;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="mt-6"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("customerId", customerId);
        formData.set("note", note);

        startTransition(async () => {
          const result = await saveClientNoteAction(formData);
          setFeedback({ message: result.message, tone: result.tone });

          if (result.ok) {
            router.refresh();
          }
        });
      }}
    >
      <div className="space-y-3">
        <FeedbackMessage message={feedback.message} tone={feedback.tone} />
      </div>

      <label className="mt-3 block">
        <span className="mb-2 block text-sm text-zinc-300">Observação interna</span>
        <textarea
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={rows}
          placeholder="Preferências, cuidados, observações importantes..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className={
          buttonClassName ||
          "mt-3 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {isPending ? "Salvando..." : "Salvar observação"}
      </button>
    </form>
  );
}
