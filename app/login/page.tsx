import LoginForm from "@/components/LoginForm";
import { isGoogleSignInConfigured } from "@/lib/googleAuth";

type LoginPageSearchParams = Promise<{
  registered?: string;
  reset?: string;
  error?: string;
  redirectTo?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: LoginPageSearchParams;
}) {
  const params = (await searchParams) || {};
  const successMessage =
    params.registered === "1"
      ? "Conta criada com sucesso. Entre para acessar seu painel."
      : params.reset === "1"
      ? "Senha atualizada com sucesso. Entre com sua nova senha."
      : null;
  const errorMessage = params.error || null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 text-white">
      <LoginForm
        errorMessage={errorMessage}
        successMessage={successMessage}
        googleSignInEnabled={isGoogleSignInConfigured()}
        redirectTo={params.redirectTo || ""}
      />
    </main>
  );
}
