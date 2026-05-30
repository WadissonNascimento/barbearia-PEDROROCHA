import RegisterForm from "@/components/RegisterForm";
import { isGoogleSignInConfigured } from "@/lib/googleAuth";

type RegisterPageSearchParams = Promise<{
  redirectTo?: string;
}>;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: RegisterPageSearchParams;
}) {
  const params = (await searchParams) || {};

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 text-white">
      <RegisterForm
        googleSignInEnabled={isGoogleSignInConfigured()}
        redirectTo={params.redirectTo}
      />
    </main>
  );
}
