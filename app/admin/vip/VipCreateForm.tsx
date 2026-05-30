"use client";

import { Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { createVipSubscriptionAction } from "./actions";

type VipCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type VipPlan = {
  id: string;
  name: string;
  combo: string;
  price: number;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function customerLabel(customer: VipCustomer) {
  return customer.name || customer.phone || customer.email || "Cliente sem nome";
}

export default function VipCreateForm({
  customers,
  plans,
}: {
  customers: VipCustomer[];
  plans: VipPlan[];
}) {
  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const filteredCustomers = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    if (!normalizedQuery) {
      return customers.slice(0, 8);
    }

    return customers
      .filter((customer) =>
        normalizeSearch(
          [customer.name, customer.email, customer.phone].filter(Boolean).join(" ")
        ).includes(normalizedQuery)
      )
      .slice(0, 8);
  }, [customers, query]);

  return (
    <form action={createVipSubscriptionAction} className="mt-4 grid min-w-0 gap-4">
      <input type="hidden" name="customerId" value={selectedCustomerId} />

      <div className="grid min-w-0 gap-2">
        <label className="text-sm font-bold text-zinc-300" htmlFor="vip-customer-search">
          Cliente
        </label>
        <div className="flex min-h-12 min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 focus-within:border-[var(--brand)]/50">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <input
            id="vip-customer-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
          />
        </div>

        <div className="grid max-h-[280px] min-w-0 gap-2 overflow-y-auto pr-1">
          {filteredCustomers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
              Nenhum cliente encontrado.
            </p>
          ) : (
            filteredCustomers.map((customer) => {
              const selected = customer.id === selectedCustomerId;

              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`min-w-0 rounded-2xl border p-3 text-left transition ${
                    selected
                      ? "border-[var(--brand)] bg-[var(--brand)]/20 text-white"
                      : "border-white/10 bg-black/20 text-zinc-300 hover:border-[var(--brand)]/40"
                  }`}
                >
                  <span className="block truncate text-sm font-black">
                    {customerLabel(customer)}
                  </span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">
                    {customer.phone || customer.email || "Sem contato"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selectedCustomer ? (
          <p className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/10 px-3 py-2 text-xs font-bold text-white">
            Selecionado: {customerLabel(selectedCustomer)}
          </p>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid min-w-0 gap-2 text-sm font-bold text-zinc-300">
          Plano
          <select
            name="planId"
            required
            className="min-h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-[var(--brand)]/50"
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} - {plan.combo} - {formatCurrency(plan.price)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-2 text-sm font-bold text-zinc-300">
          Observacao
          <input
            name="notes"
            maxLength={180}
            placeholder="opcional"
            className="min-h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[var(--brand)]/50"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={!selectedCustomerId}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:justify-self-end"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Adicionar VIP
      </button>
    </form>
  );
}
