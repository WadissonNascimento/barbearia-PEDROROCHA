"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarDays,
  ChevronRight,
  Mail,
  Phone,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { formatBrazilianPhone } from "@/lib/phone";
import { sanitizeSearchInput } from "@/lib/inputSanitization";

type ClientItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastAppointment: Date;
  totalAppointments: number;
};

export default function ClientsDirectoryClient({
  clients,
  search,
}: {
  clients: ClientItem[];
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/barber/clientes";
  const [query, setQuery] = useState(search);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,23,36,0.96),rgba(5,9,16,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
      <div className="border-b border-white/10 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--brand-strong)]">
            <UsersRound className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--brand-strong)]">
              Diretório
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              Buscar cliente
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Encontre por nome, e-mail ou telefone.
            </p>
          </div>
        </div>

        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = sanitizeSearchInput(query);

            startTransition(() => {
              router.replace(
                trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname,
                { scroll: false }
              );
            });
          }}
        >
          <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
            <div className="flex items-center gap-2">
              <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl bg-white/[0.035] px-3">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  name="q"
                  value={query}
                  onChange={(event) => setQuery(sanitizeSearchInput(event.target.value))}
                  placeholder="Nome, e-mail ou numero"
                  autoComplete="off"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "..." : "Buscar"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">
              Resultado
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-300">
              {clients.length} cliente{clients.length === 1 ? "" : "s"} encontrado
              {clients.length === 1 ? "" : "s"}
            </p>
          </div>
          {search ? (
            <Link
              href={pathname}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Limpar
            </Link>
          ) : null}
        </div>

        {clients.length === 0 ? (
          <EmptyState
            title="Nenhum cliente encontrado"
            description="Revise a busca ou aguarde novos atendimentos para ampliar sua base."
          />
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ClientCard({ client }: { client: ClientItem }) {
  const contact = formatBrazilianPhone(client.phone) || client.email || "Sem contato";
  const ContactIcon = client.phone ? Phone : client.email ? Mail : UserRound;

  return (
    <Link
      href={`/barber/clientes/${client.id}`}
      className="group block rounded-3xl border border-white/10 bg-black/20 p-4 transition hover:border-[var(--brand)]/35 hover:bg-white/[0.045]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--brand-strong)]">
          <UserRound className="h-6 w-6" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-white">
                {client.name}
              </h3>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm text-zinc-400">
                <ContactIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{contact}</span>
              </p>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-strong)]" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
        <MiniInfo
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          label="Último"
          value={new Date(client.lastAppointment).toLocaleDateString("pt-BR")}
        />
        <MiniInfo
          icon={<UsersRound className="h-3.5 w-3.5" />}
          label="Atend."
          value={String(client.totalAppointments)}
          compact
        />
      </div>
    </Link>
  );
}

function MiniInfo({
  icon,
  label,
  value,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex min-h-11 items-center gap-2 px-3 py-2 ${
        compact ? "border-l border-white/10" : ""
      }`}
    >
      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {icon}
        {label}
      </p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  );
}
