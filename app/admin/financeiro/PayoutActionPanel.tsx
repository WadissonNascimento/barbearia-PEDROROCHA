"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import {
  closeBarberPayoutAction,
  deleteBarberPayoutAction,
  markBarberPayoutAsPaidAction,
  reopenBarberPayoutAction,
} from "./actions";

type PayoutStatus = "OPEN" | "CLOSED" | "PAID";

type Size = "sm" | "md";

const buttonClassBySize: Record<Size, string> = {
  sm: "min-h-10 px-3 py-2 text-xs",
  md: "px-4 py-2 text-sm",
};

export default function PayoutActionPanel({
  payoutId,
  status,
  showDelete = false,
  size = "md",
}: {
  payoutId: string;
  status: PayoutStatus | string;
  showDelete?: boolean;
  size?: Size;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const buttonBase = buttonClassBySize[size];
  const payoutStatus: PayoutStatus =
    status === "CLOSED" || status === "PAID" ? status : "OPEN";

  function runAction(
    key: string,
    action: (formData: FormData) => Promise<{
      ok: boolean;
      message: string;
      tone: "success" | "error" | "info";
    }>
  ) {
    const formData = new FormData();
    formData.set("payoutId", payoutId);

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
    <div className="space-y-2">
      <FeedbackMessage message={feedback.message} tone={feedback.tone} />

      <div className="flex flex-wrap gap-2">
        {payoutStatus === "OPEN" && (
          <button
            type="button"
            disabled={isPending && pendingKey === "close"}
            onClick={() => runAction("close", closeBarberPayoutAction)}
            className={`btn-secondary ${buttonBase}`}
          >
            {isPending && pendingKey === "close"
              ? "Salvando..."
              : size === "sm"
              ? "Fechar"
              : "Conferir e fechar"}
          </button>
        )}

        {payoutStatus !== "PAID" && (
          <button
            type="button"
            disabled={isPending && pendingKey === "paid"}
            onClick={() => runAction("paid", markBarberPayoutAsPaidAction)}
            className={`btn-primary ${buttonBase}`}
          >
            {isPending && pendingKey === "paid"
              ? "Salvando..."
              : size === "sm"
              ? "Pagar"
              : "Marcar pago"}
          </button>
        )}

        {(payoutStatus === "PAID" || payoutStatus === "CLOSED") && (
          <button
            type="button"
            disabled={isPending && pendingKey === "reopen"}
            onClick={() => runAction("reopen", reopenBarberPayoutAction)}
            className={`btn-secondary ${buttonBase}`}
          >
            {isPending && pendingKey === "reopen" ? "Salvando..." : "Revisar de novo"}
          </button>
        )}

        {showDelete && (
          <button
            type="button"
            disabled={isPending && pendingKey === "delete"}
            onClick={() => runAction("delete", deleteBarberPayoutAction)}
            className={`btn-danger ${buttonBase}`}
          >
            {isPending && pendingKey === "delete" ? "Excluindo..." : "Excluir"}
          </button>
        )}
      </div>
    </div>
  );
}
