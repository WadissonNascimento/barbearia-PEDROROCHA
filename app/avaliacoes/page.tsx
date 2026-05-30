import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CrownRating from "@/components/ui/CrownRating";
import { getCurrentShop } from "@/lib/shop";

function formatReviewName(name: string | null) {
  const [firstName, ...rest] = (name || "Cliente").trim().split(/\s+/);
  const initial = rest[0]?.slice(0, 1);

  return initial ? `${firstName} ${initial}.` : firstName || "Cliente";
}

export default async function ReviewsPage() {
  const shop = await getCurrentShop();
  const reviews = await prisma.review.findMany({
    where: {
      shopId: shop.id,
      isVisible: true,
    },
    include: {
      customer: {
        select: {
          name: true,
        },
      },
      barber: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
  });

  return (
    <main className="page-shell max-w-6xl text-white">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Avaliações
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Clientes da {shop.name || "barbearia"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Comentários enviados depois de atendimentos concluídos.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/5"
        >
          Voltar para home
        </Link>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-sm text-zinc-400">
          Ainda não há avaliações públicas.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <CrownRating rating={review.rating} />
                <p className="text-xs text-zinc-500">
                  {new Date(review.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-300">
                {review.comment}
              </p>
              <p className="mt-5 text-sm font-semibold text-white">
                {formatReviewName(review.customer.name)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Atendimento com {review.barber.name || "barbeiro"}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
