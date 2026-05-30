"use client";

import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { upsertBarberServiceCommissionAction } from "../../actions";

type ServiceItem = {
  id: string;
  name: string;
  price: number;
  duration: number;
  barberId: string | null;
  commissionType: string;
  commissionValue: number;
  customCommission: {
    commissionType: string;
    commissionValue: number;
  } | null;
};

function formatCommission(type: string, value: number) {
  return type === "FIXED" ? formatCurrency(value) : `${value}%`;
}

export default function ServiceCommissionListClient({
  barberId,
  services,
}: {
  barberId: string;
  services: ServiceItem[];
}) {
  const [openServiceId, setOpenServiceId] = useState<string | null>(services[0]?.id || null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [commissionTypesByService, setCommissionTypesByService] = useState<
    Record<string, string>
  >({});
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveCommission(formData: FormData, serviceId: string) {
    setPendingKey(serviceId);

    startTransition(async () => {
      const result = await upsertBarberServiceCommissionAction(formData);
      setFeedback({ message: result.message, tone: result.tone });
      if (result.ok) {
        setEditingServiceId(null);
      }
      setPendingKey(null);
    });
  }

  function toggleService(serviceId: string) {
    setOpenServiceId((current) => {
      const next = current === serviceId ? null : serviceId;
      if (next !== serviceId) {
        setEditingServiceId(null);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <FeedbackMessage message={feedback.message} tone={feedback.tone} />

      {services.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-400">
          Nenhum serviço disponível para esse barbeiro.
        </div>
      ) : (
        services.map((service) => {
          const isOpen = openServiceId === service.id;
          const isEditing = editingServiceId === service.id;
          const selectedType =
            service.customCommission?.commissionType || service.commissionType || "PERCENT";
          const currentType = commissionTypesByService[service.id] || selectedType;
          const selectedValue =
            service.customCommission?.commissionValue ?? service.commissionValue ?? 0;

          return (
            <article
              key={service.id}
              className="overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,40,61,0.72),rgba(13,18,30,0.98))] shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleService(service.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.035]"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">
                    {service.name}
                  </p>
                  <p className="mt-1 truncate text-sm leading-5 text-zinc-400">
                    {service.duration} min
                  </p>
                  <p className="mt-0.5 whitespace-nowrap text-sm font-semibold leading-5 text-zinc-300">
                    {formatCurrency(service.price)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge variant={service.barberId ? "info" : "neutral"}>
                    {service.barberId ? "Exclusivo" : "Geral"}
                  </StatusBadge>
                  <span className="text-lg text-zinc-500">{isOpen ? "-" : "+"}</span>
                </div>
              </button>

              {isOpen ? (
                isEditing ? (
                  <form
                    className="border-t border-white/10 px-3.5 pb-3.5 pt-3.5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveCommission(new FormData(event.currentTarget), service.id);
                    }}
                  >
                    <input type="hidden" name="barberId" value={barberId} />
                    <input type="hidden" name="serviceId" value={service.id} />

                    <div className="service-edit-row service-edit-row-commission">
                      <label className="block min-w-0">
                        <span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                          Tipo
                        </span>
                        <select
                          name="commissionType"
                          value={currentType}
                          onChange={(event) =>
                            setCommissionTypesByService((current) => ({
                              ...current,
                              [service.id]: event.target.value,
                            }))
                          }
                          className="form-control"
                        >
                          <option value="PERCENT">Percentual</option>
                          <option value="FIXED">Valor fixo</option>
                        </select>
                      </label>

                      <label className="block min-w-0">
                        <span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                          Comissão
                        </span>
                        <div className="input-with-suffix">
                          <input
                            name="commissionValue"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={selectedValue}
                            className="form-control input-with-suffix-control"
                          />
                          <span className="input-suffix">
                            {currentType === "FIXED" ? "R$" : "%"}
                          </span>
                        </div>
                      </label>

                      <button
                        type="submit"
                        disabled={isPending && pendingKey === service.id}
                        className="btn-primary self-end"
                      >
                        {isPending && pendingKey === service.id ? "Salvando..." : "Salvar"}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingServiceId(null)}
                      className="btn-secondary mt-2 w-full"
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className="border-t border-white/10 px-3.5 pb-3.5 pt-3.5">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <SummaryTile
                        label="Padrão"
                        value={formatCommission(service.commissionType, service.commissionValue)}
                      />
                      <SummaryTile
                        label="Atual"
                        value={formatCommission(currentType, selectedValue)}
                        accent
                      />
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingServiceId(service.id)}
                        className="btn-secondary"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                )
              ) : null}
            </article>
          );
        })
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-2.5">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-bold ${
          accent ? "text-[var(--brand-strong)]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
