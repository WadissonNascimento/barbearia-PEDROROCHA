import Link from "next/link";
import { Clock3 } from "lucide-react";

export const metadata = {
  title: "Sobre nós",
  description: "Pagina em manutencao enquanto preparamos a historia da barbearia.",
};

export default function SobreNosPage() {
  return (
    <main className="page-shell max-w-3xl text-white">
      <section className="surface-card-strong rounded-[28px] p-6 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] text-[var(--brand-strong)]">
          <Clock3 className="h-6 w-6" />
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
          Sobre nós
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
          Pagina em manutencao
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
          Estamos preparando o conteudo oficial com a historia, fotos e detalhes
          da barbearia. Em breve esta pagina sera atualizada.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/agendar"
            className="rounded-lg bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
          >
            Agendar horario
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] active:scale-[0.98]"
          >
            Voltar ao inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
