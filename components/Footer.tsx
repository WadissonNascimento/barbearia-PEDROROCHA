import Link from "next/link";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export default function Footer({
  brandName,
  whatsappNumber,
  instagramUrl,
  locationUrl,
  businessHours,
}: {
  brandName: string;
  whatsappNumber: string;
  instagramUrl: string;
  addressLine: string;
  locationUrl: string;
  businessHours: string;
}) {
  const whatsappMessage =
    `Ola! Vim pelo site da ${brandName} e queria tirar uma dúvida.`
  ;
  const whatsappHref = buildWhatsAppUrl(whatsappNumber, whatsappMessage);
  const displayedBusinessHours = businessHours.replace(/\b[Tt]erca\b/g, (match) =>
    match.startsWith("t") ? "terça" : "Terça"
  );

  return (
    <footer className="relative mt-14 border-t border-white/10 bg-[#030712] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,_rgba(56,189,248,0.16),_transparent_36%)]" />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div>
              <p className="text-lg font-bold">{brandName}</p>
              <p className="text-xs text-zinc-400">Atendimento com hora marcada</p>
            </div>
          </Link>

          <div className="grid gap-3 text-sm text-zinc-400 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Funcionamento
              </p>
              <p className="mt-2 text-zinc-200">{displayedBusinessHours}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Experiência
              </p>
              <p className="mt-2 text-zinc-200">
                Agenda rápida no celular e acompanhamento em tempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brand-strong)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand-muted)] hover:text-[var(--brand-strong)]"
                aria-label="Instagram"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M7.75 2C4.57 2 2 4.57 2 7.75v8.5C2 19.43 4.57 22 7.75 22h8.5C19.43 22 22 19.43 22 16.25v-8.5C22 4.57 19.43 2 16.25 2h-8.5zm0 2h8.5A3.75 3.75 0 0 1 20 7.75v8.5A3.75 3.75 0 0 1 16.25 20h-8.5A3.75 3.75 0 0 1 4 16.25v-8.5A3.75 3.75 0 0 1 7.75 4zm4.25 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm4.75-.88a1.12 1.12 0 1 0 0 2.24 1.12 1.12 0 0 0 0-2.24z" />
                </svg>
              </a>
            ) : null}

            {locationUrl ? (
              <a
                href={locationUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brand-strong)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand-muted)] hover:text-[var(--brand-strong)]"
                aria-label="Localizacao da barbearia"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
                </svg>
              </a>
            ) : null}

            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brand-strong)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand-muted)] hover:text-[var(--brand-strong)]"
                aria-label="WhatsApp"
              >
                <WhatsAppIcon />
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {brandName}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/sobre-nos"
              className="text-zinc-400 transition hover:text-[var(--brand-strong)]"
            >
              Sobre nós
            </Link>
            <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
            <Link
              href="/servicos"
              className="text-zinc-400 transition hover:text-[var(--brand-strong)]"
            >
              Serviços
            </Link>
            <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
            <Link
              href="/maquinas"
              className="text-zinc-400 transition hover:text-[var(--brand-strong)]"
            >
              Maquinas
            </Link>
            <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
            <p className="text-zinc-500">Cuidado em cada detalhe</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 448 512"
      className="h-5 w-5"
      fill="currentColor"
    >
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32 101.5 32 1.9 131.6 1.9 254c0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68.1-4.4-7C49.1 322.8 39.4 288.9 39.4 254c0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.5-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.5-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.6-6.6z" />
    </svg>
  );
}
