"use client";

import { Repeat2 } from "lucide-react";
import { useState } from "react";
import AdminWalkInAppointmentButton from "@/app/admin/agenda/AdminWalkInAppointmentButton";
import type {
  AdminAgendaBarber,
  AdminAgendaCustomer,
  AdminAgendaExtra,
  AdminAgendaService,
} from "@/app/admin/agenda/AdminAgendaClient";

export default function RecurringAppointmentCreator({
  barbers,
  services,
  extras,
  customers,
  selectedDate,
}: {
  barbers: AdminAgendaBarber[];
  services: AdminAgendaService[];
  extras: AdminAgendaExtra[];
  customers: AdminAgendaCustomer[];
  selectedDate: string;
}) {
  const [selectedBarberId, setSelectedBarberId] = useState("");

  return (
    <section className="mt-6 rounded-3xl border border-[var(--brand)]/25 bg-[var(--brand)]/[0.06] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            <Repeat2 className="h-4 w-4" aria-hidden="true" />
            Nova série
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Criar cliente recorrente
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-300">
            Escolha o barbeiro e cadastre o cliente com frequência semanal, quinzenal ou mensal.
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end lg:w-auto">
          <label className="min-w-0 flex-1 sm:min-w-[230px]">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
              Barbeiro
            </span>
            <select
              value={selectedBarberId}
              onChange={(event) => setSelectedBarberId(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-white/10 bg-[#090909] px-3 text-sm font-bold text-white outline-none focus:border-[var(--brand)]/50"
            >
              <option value="">Selecione um barbeiro</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name || barber.email || "Barbeiro"}
                </option>
              ))}
            </select>
          </label>

          <AdminWalkInAppointmentButton
            barbers={barbers}
            services={services}
            extras={extras}
            customers={customers}
            selectedBarberId={selectedBarberId}
            selectedDate={selectedDate}
            buttonLabel="Criar cliente recorrente"
            modalTitle="Criar cliente recorrente"
          />
        </div>
      </div>
    </section>
  );
}
