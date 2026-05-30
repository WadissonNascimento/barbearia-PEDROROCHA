import AccountPasswordForm from "@/components/AccountPasswordForm";
import { updateOwnAccountPasswordAction } from "@/app/accountPasswordActions";
import BarberProfileSettings from "../_components/BarberProfileSettings";
import { requireActiveBarber } from "../guard";
import {
  updateOwnBarberContactAction,
  updateOwnBarberPhotoAction,
} from "../actions";

export default async function BarberProfilePage() {
  const { barber } = await requireActiveBarber();
  const barberName = barber.name || "Barbeiro";

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-5 text-white sm:px-6 sm:py-8">
        <section className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            Configurar perfil
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Seu perfil de barbeiro
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Atualize sua foto, contato e senha do painel.
          </p>
        </section>

        <div className="space-y-4">
          <BarberProfileSettings
            photoAction={updateOwnBarberPhotoAction}
            contactAction={updateOwnBarberContactAction}
            currentImage={barber.image}
            name={barberName}
            email={barber.email}
            phone={barber.phone}
          />

          <AccountPasswordForm
            action={updateOwnAccountPasswordAction}
            title="Senha do painel"
            description="Atualize a senha usada para entrar no painel do barbeiro."
          />
        </div>
      </div>
    </div>
  );
}
