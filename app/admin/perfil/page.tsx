import AccountPasswordForm from "@/components/AccountPasswordForm";
import { updateOwnAccountPasswordAction } from "@/app/accountPasswordActions";
import { prisma } from "@/lib/prisma";
import AdminProfileForm from "../AdminProfileForm";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

export default async function AdminProfilePage() {
  const { session } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const adminProfile = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      name: true,
      email: true,
      phone: true,
    },
  });

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-5 text-white sm:px-6 sm:py-8">
        <section className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            Configurar perfil
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Seu perfil de admin
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Atualize seus dados de contato e a senha do painel administrativo.
          </p>
        </section>

        <div className="space-y-4">
          <AdminProfileForm
            name={adminProfile?.name || ""}
            email={adminProfile?.email || ""}
            phone={adminProfile?.phone || null}
          />

          <AccountPasswordForm
            action={updateOwnAccountPasswordAction}
            title="Senha do admin"
            description="Atualize a senha usada para entrar no painel administrativo."
          />
        </div>
      </div>
    </div>
  );
}
