import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import EmptyState from "@/components/ui/EmptyState";
import SummaryStatsPanel from "@/components/ui/SummaryStatsPanel";
import { normalizeProductImageUrl } from "@/lib/productImageUrl";
import { toMoneyNumber } from "@/lib/money";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import ProductCardClient from "../produtos/ProductCardClient";

export default async function MaquinasAdminPage() {
  await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      secondaryImages: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          url: true,
        },
      },
    },
  });

  const activeProducts = products.filter((product) => product.isActive).length;
  const hiddenProducts = products.length - activeProducts;

  return (
    <DashboardShell size="wide">
      <section className="dashboard-panel p-4 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              Painel admin
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Maquinas
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Catalogo, imagens, precos e visibilidade das maquinas vendidas.
            </p>
          </div>

          <Link href="/admin/maquinas/novo" className="btn-primary w-full sm:w-auto">
            Nova maquina
          </Link>
        </div>

        <SummaryStatsPanel
          className="my-5"
          title="Resumo do catalogo"
          description="Leitura rapida antes de editar as maquinas."
          stats={[
            {
              label: "Maquinas ativas",
              value: activeProducts,
              helper: "Visiveis no catalogo",
            },
            {
              label: "Maquinas ocultas",
              value: hiddenProducts,
              helper: "Fora do catalogo",
              tone: hiddenProducts > 0 ? "warning" : undefined,
            },
            {
              label: "Total",
              value: products.length,
              helper: "Itens cadastrados",
            },
          ]}
        />

        <div className="border-t border-white/10 pt-5">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
              Catalogo
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              Lista de maquinas
            </h2>
          </div>

          {products.length === 0 ? (
            <EmptyState
              title="Nenhuma maquina cadastrada"
              description="Adicione a primeira maquina para iniciar o catalogo."
              actionLabel="Nova maquina"
              actionHref="/admin/maquinas/novo"
            />
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <ProductCardClient
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    category: product.category,
                    price: toMoneyNumber(product.price),
                    isActive: product.isActive,
                    imageUrl: normalizeProductImageUrl(product.imageUrl),
                    secondaryImages: product.secondaryImages.map((image) => ({
                      id: image.id,
                      url: normalizeProductImageUrl(image.url) || image.url,
                    })),
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
