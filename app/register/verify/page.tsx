import { redirect } from "next/navigation";
import RegisterVerifyForm from "@/components/RegisterVerifyForm";

type RegisterVerifySearchParams = Promise<{
  email?: string;
  sent?: string;
  devCode?: string;
  redirectTo?: string;
}>;

export default async function RegisterVerifyPage({
  searchParams,
}: {
  searchParams: RegisterVerifySearchParams;
}) {
  const params = await searchParams;
  const email = String(params.email || "").trim().toLowerCase();

  if (!email) {
    redirect("/register");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020b1a] px-4 text-white">
      <RegisterVerifyForm
        email={email}
        sent={params.sent === "1"}
        devCode={params.devCode}
        redirectTo={params.redirectTo}
      />
    </main>
  );
}
