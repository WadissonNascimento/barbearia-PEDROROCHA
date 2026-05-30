"use client";

import { MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import EmptyState from "@/components/ui/EmptyState";
import CrownRating from "@/components/ui/CrownRating";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  deleteReviewAction,
  toggleReviewVisibilityAction,
} from "./actions";

type ReviewItem = {
  id: string;
  rating: number;
  comment: string;
  isVisible: boolean;
  createdAt: Date;
  customer: {
    name: string | null;
    email: string | null;
  };
  barber: {
    name: string | null;
  };
};

export default function AdminReviewsClient({
  reviews,
}: {
  reviews: ReviewItem[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(reviews[0]?.id || null);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleCount = reviews.filter((review) => review.isVisible).length;
  const hiddenCount = reviews.length - visibleCount;
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  function runAction(
    key: string,
    action: (formData: FormData) => Promise<{
      ok: boolean;
      message: string;
      tone: "success" | "error" | "info";
    }>,
    formData: FormData
  ) {
    setPendingKey(key);

    startTransition(async () => {
      const result = await action(formData);
      setFeedback({ message: result.message, tone: result.tone });

      if (result.ok) {
        router.refresh();
      }

      setPendingKey(null);
    });
  }

  return (
    <div className="pt-5">
      <FeedbackMessage message={feedback.message} tone={feedback.tone} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ReviewMetric label="Total" value={reviews.length} helper="recebidas" />
        <ReviewMetric label="Públicas" value={visibleCount} helper="visíveis" accent />
        <ReviewMetric label="Ocultas" value={hiddenCount} helper="fora do site" />
        <ReviewMetric
          label="Média"
          value={averageRating ? averageRating.toFixed(1) : "0"}
          helper="coroas"
          accent
        />
      </div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
            Comentários
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">Avaliações dos clientes</h2>
        </div>

        {reviews.length === 0 ? (
          <EmptyState
            title="Nenhuma avaliação recebida"
            description="As avaliações aparecem aqui depois que clientes avaliarem atendimentos concluídos."
          />
        ) : (
          <div className="space-y-2.5">
            {reviews.map((review) => {
              const isOpen = openId === review.id;
              const customerName =
                review.customer.name || review.customer.email || "Cliente";

              return (
                <article
                  key={review.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : review.id)}
                    className="grid w-full grid-cols-[2.75rem_1fr_auto] items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.035]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--brand)]">
                      <MessageSquareText className="h-5 w-5" />
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-white">
                        {customerName}
                      </span>
                      <span className="mt-1 block truncate text-xs text-zinc-400">
                        {review.barber.name || "Barbeiro"} -{" "}
                        {new Date(review.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge variant={review.isVisible ? "success" : "neutral"}>
                        {review.isVisible ? "Pública" : "Oculta"}
                      </StatusBadge>
                      <span className="text-lg text-zinc-500">{isOpen ? "-" : "+"}</span>
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-white/10 px-3.5 pb-3.5 pt-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CrownRating rating={review.rating} size="sm" />
                        <span className="text-xs font-semibold text-zinc-500">
                          {review.rating}/5
                        </span>
                      </div>

                      <p className="mt-3 break-words rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-300">
                        {review.comment}
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={isPending && pendingKey === `toggle-${review.id}`}
                          onClick={() => {
                            const formData = new FormData();
                            formData.set("reviewId", review.id);
                            runAction(
                              `toggle-${review.id}`,
                              toggleReviewVisibilityAction,
                              formData
                            );
                          }}
                          className={
                            review.isVisible ? "btn-warning-soft" : "btn-secondary"
                          }
                        >
                          {isPending && pendingKey === `toggle-${review.id}`
                            ? "Salvando..."
                            : review.isVisible
                            ? "Ocultar"
                            : "Publicar"}
                        </button>

                        <button
                          type="button"
                          disabled={isPending && pendingKey === `delete-${review.id}`}
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Excluir esta avaliação definitivamente?"
                              )
                            ) {
                              return;
                            }

                            const formData = new FormData();
                            formData.set("reviewId", review.id);
                            runAction(`delete-${review.id}`, deleteReviewAction, formData);
                          }}
                          className="btn-danger"
                        >
                          {isPending && pendingKey === `delete-${review.id}`
                            ? "Excluindo..."
                            : "Excluir"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewMetric({
  label,
  value,
  helper,
  accent = false,
}: {
  label: string;
  value: string | number;
  helper: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-bold leading-none ${
          accent ? "text-[var(--brand-strong)]" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-zinc-400">{helper}</p>
    </div>
  );
}
