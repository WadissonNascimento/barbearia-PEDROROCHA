"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import {
  createAdminServiceAction,
  deleteGlobalServiceAction,
  toggleGlobalServiceAction,
  updateGlobalServiceAction,
} from "./actions";

type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  commissionValue: number;
  isActive: boolean;
  barber: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type BarberOption = {
  id: string;
  name: string | null;
  email: string | null;
};

type ActionResult = {
  ok: boolean;
  message: string;
  tone: "success" | "error" | "info";
};

export default function AdminServicesClient({
  globalServices,
  barberServices,
  barbers,
}: {
  globalServices: ServiceItem[];
  barberServices: ServiceItem[];
  barbers: BarberOption[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [openServiceId, setOpenServiceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [serviceScope, setServiceScope] = useState<"GLOBAL" | "EXCLUSIVE">("GLOBAL");

  function runAction(
    key: string,
    action: (formData: FormData) => Promise<ActionResult>,
    formData: FormData,
    onSuccess?: () => void
  ) {
    setPendingKey(key);

    startTransition(async () => {
      const result = await action(formData);
      setFeedback({ message: result.message, tone: result.tone });

      if (result.ok) {
        onSuccess?.();
        router.refresh();
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
    <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
      <FeedbackMessage message={feedback.message} tone={feedback.tone} />

      <section className="dashboard-subpanel p-3.5 sm:p-5">
        <form
          className="space-y-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;

            runAction(
              "create-service",
              createAdminServiceAction,
              new FormData(form),
              () => {
                form.reset();
                setServiceScope("GLOBAL");
              }
            );
          }}
        >
          <div className="grid gap-3 md:grid-cols-[1fr_15rem] md:items-end">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                Cadastro
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Novo serviço</h2>
            </div>

            <div className="grid w-full grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setServiceScope("GLOBAL")}
                className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition ${
                  serviceScope === "GLOBAL"
                    ? "bg-[var(--brand)] text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                Geral
              </button>

              <button
                type="button"
                onClick={() => setServiceScope("EXCLUSIVE")}
                className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition ${
                  serviceScope === "EXCLUSIVE"
                    ? "bg-[var(--brand)] text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                Exclusivo
              </button>
            </div>
          </div>

          <input type="hidden" name="serviceScope" value={serviceScope} />

          <div className="grid gap-3 md:grid-cols-2">
            {serviceScope === "EXCLUSIVE" ? (
              <Field label="Barbeiro responsável">
                <select
                  name="barberId"
                  required
                  defaultValue=""
                  className="service-edit-control"
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name || barber.email || "Barbeiro"}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="Nome">
              <input
                name="name"
                required
                maxLength={120}
                className="service-edit-control"
                placeholder={
                  serviceScope === "GLOBAL"
                    ? "Ex.: Corte + barba"
                    : "Ex.: Platinado premium"
                }
              />
            </Field>
          </div>

          <input type="hidden" name="description" value="" />

          <div className="service-compact-fields">
            <Field label="Preço">
              <input
                type="number"
                step="0.01"
                min="1"
                name="price"
                required
                className="service-edit-control"
              />
            </Field>

            <Field label="Duração">
              <input
                type="number"
                min="10"
                step="5"
                name="duration"
                required
                className="service-edit-control"
              />
            </Field>

            <Field label="Comissão">
              <div className="input-with-suffix">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  name="commissionValue"
                  defaultValue={40}
                  required
                  className="service-edit-control input-with-suffix-control"
                />
                <span className="input-suffix">%</span>
              </div>
            </Field>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isPending && pendingKey === "create-service"}
              className="btn-primary w-full sm:w-auto"
            >
              {isPending && pendingKey === "create-service"
                ? "Criando..."
                : serviceScope === "EXCLUSIVE"
                ? "Criar exclusivo"
                : "Criar geral"}
            </button>
          </div>
        </form>
      </section>

      <ServiceSection
        title="Serviços gerais"
        emptyText="Nenhum serviço geral cadastrado."
        services={globalServices}
        openServiceId={openServiceId}
        editingServiceId={editingServiceId}
        isPending={isPending}
        pendingKey={pendingKey}
        onToggleOpen={toggleService}
        onStartEditing={setEditingServiceId}
        onCancelEditing={() => setEditingServiceId(null)}
        onRunAction={runAction}
      />

      <ServiceSection
        title="Serviços exclusivos dos barbeiros"
        emptyText="Nenhum serviço exclusivo cadastrado."
        services={barberServices}
        openServiceId={openServiceId}
        editingServiceId={editingServiceId}
        isPending={isPending}
        pendingKey={pendingKey}
        onToggleOpen={toggleService}
        onStartEditing={setEditingServiceId}
        onCancelEditing={() => setEditingServiceId(null)}
        onRunAction={runAction}
      />
    </div>
  );
}

function ServiceSection({
  title,
  emptyText,
  services,
  openServiceId,
  editingServiceId,
  isPending,
  pendingKey,
  onToggleOpen,
  onStartEditing,
  onCancelEditing,
  onRunAction,
}: {
  title: string;
  emptyText: string;
  services: ServiceItem[];
  openServiceId: string | null;
  editingServiceId: string | null;
  isPending: boolean;
  pendingKey: string | null;
  onToggleOpen: (serviceId: string) => void;
  onStartEditing: (serviceId: string) => void;
  onCancelEditing: () => void;
  onRunAction: (
    key: string,
    action: (formData: FormData) => Promise<ActionResult>,
    formData: FormData,
    onSuccess?: () => void
  ) => void;
}) {
  return (
    <section className="dashboard-subpanel p-3.5 sm:p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>

      <div className="mt-3 space-y-2.5">
        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
            {emptyText}
          </div>
        ) : (
          services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              isOpen={openServiceId === service.id}
              isEditing={editingServiceId === service.id}
              isPending={isPending}
              pendingKey={pendingKey}
              onToggleOpen={() => onToggleOpen(service.id)}
              onStartEditing={() => onStartEditing(service.id)}
              onCancelEditing={onCancelEditing}
              onRunAction={onRunAction}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ServiceCard({
  service,
  isOpen,
  isEditing,
  isPending,
  pendingKey,
  onToggleOpen,
  onStartEditing,
  onCancelEditing,
  onRunAction,
}: {
  service: ServiceItem;
  isOpen: boolean;
  isEditing: boolean;
  isPending: boolean;
  pendingKey: string | null;
  onToggleOpen: () => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onRunAction: (
    key: string,
    action: (formData: FormData) => Promise<ActionResult>,
    formData: FormData,
    onSuccess?: () => void
  ) => void;
}) {
  const ownerLabel = service.barber
    ? `Exclusivo de ${service.barber.name || service.barber.email || "Barbeiro"}`
    : "Serviço geral";

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.035]"
      >
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">{service.name}</p>
          <p className="mt-1 truncate text-sm leading-5 text-zinc-400">
            {ownerLabel} · {service.duration} min
          </p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-semibold leading-5 text-zinc-300">
            R$ {service.price.toFixed(2)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
              service.isActive
                ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
                : "border-red-500/25 bg-red-500/10 text-red-200"
            }`}
          >
            {service.isActive ? "Ativo" : "Off"}
          </span>
          <span className="text-lg text-zinc-500">{isOpen ? "-" : "+"}</span>
        </div>
      </button>

      {isOpen ? (
        isEditing ? (
          <form
            className="border-t border-white/10 px-3.5 pb-3.5 pt-3.5"
            onSubmit={(event) => {
              event.preventDefault();
              onRunAction(
                `update-${service.id}`,
                updateGlobalServiceAction,
                new FormData(event.currentTarget),
                onCancelEditing
              );
            }}
          >
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="description" value={service.description || ""} />

            <div className="service-edit-row">
              <Field label="Nome" className="service-edit-name">
                <input
                  name="name"
                  defaultValue={service.name}
                  required
                  maxLength={120}
                  className="service-edit-control"
                />
              </Field>

              <Field label="Preço">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  name="price"
                  defaultValue={service.price}
                  required
                  className="service-edit-control"
                />
              </Field>

              <Field label="Duração">
                <input
                  type="number"
                  min="10"
                  step="5"
                  name="duration"
                  defaultValue={service.duration}
                  required
                  className="service-edit-control"
                />
              </Field>

              <Field label="Comissão">
                <div className="input-with-suffix">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    name="commissionValue"
                    defaultValue={service.commissionValue}
                    required
                    className="service-edit-control input-with-suffix-control"
                  />
                  <span className="input-suffix">%</span>
                </div>
              </Field>
            </div>

            <div className="service-action-stack">
              <div className="service-action-row service-action-row-primary">
                <button
                  type="submit"
                  disabled={isPending && pendingKey === `update-${service.id}`}
                  className="btn-primary"
                >
                  {isPending && pendingKey === `update-${service.id}` ? "Salvando..." : "Salvar"}
                </button>
                <button type="button" onClick={onCancelEditing} className="btn-secondary">
                  Cancelar
                </button>
              </div>

              <div className="service-action-row service-action-row-danger">
                <button
                  type="button"
                  disabled={isPending && pendingKey === `toggle-${service.id}`}
                  onClick={() => {
                    const formData = new FormData();
                    formData.set("serviceId", service.id);
                    onRunAction(`toggle-${service.id}`, toggleGlobalServiceAction, formData);
                  }}
                  className={service.isActive ? "btn-warning-soft" : "btn-secondary"}
                >
                  {isPending && pendingKey === `toggle-${service.id}`
                    ? "Salvando..."
                    : service.isActive
                    ? "Desativar"
                    : "Ativar"}
                </button>

                <button
                  type="button"
                  disabled={isPending && pendingKey === `delete-${service.id}`}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Excluir serviço? Se houver agendamentos no histórico, ele será apenas desativado."
                      )
                    ) {
                      return;
                    }

                    const formData = new FormData();
                    formData.set("serviceId", service.id);
                    onRunAction(`delete-${service.id}`, deleteGlobalServiceAction, formData);
                  }}
                  className="btn-danger"
                >
                  {isPending && pendingKey === `delete-${service.id}` ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="border-t border-white/10 px-3.5 pb-3.5 pt-3.5">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <SummaryTile label="Preço" value={`R$ ${service.price.toFixed(2)}`} />
              <SummaryTile label="Duração" value={`${service.duration} min`} />
              <SummaryTile
                label="Comissão"
                value={`${service.commissionValue}%`}
                accent
              />
            </div>

            <div className="mt-3 flex justify-end">
              <button type="button" onClick={onStartEditing} className="btn-secondary">
                Editar
              </button>
            </div>
          </div>
        )
      ) : null}
    </article>
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

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
