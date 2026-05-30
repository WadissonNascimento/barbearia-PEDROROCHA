import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  HeartPulse,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  Scissors,
  Sparkles,
  Star,
  UserRound,
  Wallet,
} from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  getAppointmentDisplayName,
  getAppointmentTotalPrice,
} from "@/lib/appointmentServices";
import { formatAppointmentPublicId } from "@/lib/appointmentPublicId";
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
  normalizeAppointmentStatus,
} from "@/lib/appointmentStatus";
import { paymentMethodLabel } from "@/lib/paymentMethods";
import { formatBrazilianPhone } from "@/lib/phone";
import { formatCurrency } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { ClientNoteForm } from "../../_components/ClientNoteForm";
import { getBarberClientProfile } from "../../data";
import { requireActiveBarber } from "../../guard";

export default async function BarberClientProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
  searchParams?: { feedback?: string; tone?: string };
}) {
  noStore();

  const { barber } = await requireActiveBarber();
  const { customerId } = await params;

  const profile = await getBarberClientProfile(barber.id, customerId);

  if (!profile) {
    notFound();
  }

  const phoneHref = profile.customer.phone
    ? `tel:${profile.customer.phone.replace(/\D/g, "")}`
    : null;
  const whatsappHref = buildWhatsAppUrl(profile.customer.phone);
  const emailHref = profile.customer.email ? `mailto:${profile.customer.email}` : null;
  const formattedPhone = formatBrazilianPhone(profile.customer.phone);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-white">
      <BackLink href="/barber/clientes" area="Clientes" className="mb-5" />

      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,23,36,0.96),rgba(5,9,16,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--brand-strong)]">
            Perfil do cliente
          </p>
          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-[var(--brand-strong)]">
              <UserRound className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-black tracking-tight text-white">
                {profile.customer.name}
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Histórico, preferências e observações importantes para atender melhor.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ContactButton
              href={phoneHref}
              icon={<Phone className="h-4 w-4" />}
              label={formattedPhone || "Sem telefone"}
            />
            <ContactButton
              href={whatsappHref}
              icon={<MessageCircle className="h-4 w-4" />}
              label="WhatsApp"
            />
            <ContactButton
              href={emailHref}
              icon={<Mail className="h-4 w-4" />}
              label={profile.customer.email || "Sem e-mail"}
            />
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                icon={<CalendarDays className="h-4 w-4" />}
                label="Atend."
                value={profile.stats.totalAppointments}
              />
              <MiniStat
                icon={<Star className="h-4 w-4" />}
                label="Concluídos"
                value={profile.stats.completedAppointments}
              />
              <MiniStat
                icon={<Wallet className="h-4 w-4" />}
                label="Serviços"
                value={formatCurrency(profile.stats.totalSpent)}
              />
              <MiniStat
                icon={<Scissors className="h-4 w-4" />}
                label="Favorito"
                value={profile.stats.favoriteService || "-"}
              />
            </div>

            <InfoPanel title="Dados do cliente" icon={<UserRound className="h-5 w-5" />}>
              <InfoRow
                label="Cliente desde"
                value={new Date(profile.customer.createdAt).toLocaleDateString("pt-BR")}
              />
              <InfoRow
                label="Nascimento"
                value={
                  profile.customer.birthDate
                    ? new Date(profile.customer.birthDate).toLocaleDateString("pt-BR")
                    : "Não informado"
                }
              />
              <InfoRow
                label="Barbeiro preferido"
                value={profile.customer.preferredBarberName || "Sem preferência"}
              />
            </InfoPanel>

            <InfoPanel title="Cuidados" icon={<HeartPulse className="h-5 w-5" />}>
              <InfoRow
                label="Alergias ou cuidados"
                value={profile.customer.allergies || "Nenhuma observação registrada"}
              />
              <InfoRow
                label="Preferências"
                value={profile.customer.preferences || "Nenhuma preferência registrada"}
              />
            </InfoPanel>

            <InfoPanel title="Observação interna" icon={<NotebookPen className="h-5 w-5" />}>
              <ClientNoteForm
                customerId={profile.customer.id}
                initialNote={profile.customer.note}
                rows={4}
                buttonClassName="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[var(--brand)] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </InfoPanel>
          </aside>

          <main>
            <SectionCard
              title="Histórico"
              description="Atendimentos realizados e próximos registros desse cliente."
              className="rounded-[28px]"
            >
              <div className="space-y-3">
                {profile.appointments.length === 0 ? (
                  <EmptyState
                    title="Sem atendimentos registrados"
                    description="Assim que esse cliente concluir atendimentos, o histórico aparecerá aqui."
                  />
                ) : (
                  profile.appointments.map((appointment) => (
                    <article
                      key={appointment.id}
                      className="rounded-3xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                            {formatAppointmentPublicId(appointment.publicId)}
                          </p>
                          <p className="mt-2 text-2xl font-black tracking-tight text-white">
                            {new Date(appointment.date).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {getAppointmentDisplayName(appointment.services)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {new Date(appointment.date).toLocaleDateString("pt-BR")}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <StatusBadge variant={appointmentStatusVariant(appointment.status)}>
                            {appointmentStatusLabel(appointment.status)}
                          </StatusBadge>
                          {normalizeAppointmentStatus(appointment.status) === "COMPLETED" ? (
                            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-100">
                              {paymentMethodLabel(appointment.paymentMethod)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <CompactInfo
                          label="Valor"
                          value={formatCurrency(getAppointmentTotalPrice(appointment.services))}
                        />
                        <CompactInfo
                          label="Itens"
                          value={appointment.items.length ? `${appointment.items.length}` : "0"}
                        />
                      </div>

                      {appointment.notes ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                            Observação
                          </p>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">
                            {appointment.notes}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </SectionCard>
          </main>
        </div>
      </section>
    </div>
  );
}

function ContactButton({
  href,
  icon,
  label,
}: {
  href: string | null;
  icon: React.ReactNode;
  label: string;
}) {
  const className =
    "inline-flex min-h-11 items-center justify-center gap-2 truncate rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:border-[var(--brand)]/45 hover:bg-[var(--brand-muted)] hover:text-white";

  if (!href) {
    return (
      <span className={`${className} opacity-50`}>
        {icon}
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} className={className}>
      {icon}
      <span className="truncate">{label}</span>
    </a>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-black text-white">{value}</p>
    </div>
  );
}

function InfoPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--brand-strong)]">
          {icon}
        </span>
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-200">{value}</p>
    </div>
  );
}

function CompactInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
