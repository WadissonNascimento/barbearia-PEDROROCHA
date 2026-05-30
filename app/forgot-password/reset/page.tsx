import { redirect } from "next/navigation";
import ResetPasswordForm from "@/components/ResetPasswordForm";

type ResetPasswordSearchParams = Promise<{
  email?: string;
  sent?: string;
  devCode?: string;
}>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: ResetPasswordSearchParams;
}) {
  const params = await searchParams;
  const email = String(params.email || "").trim().toLowerCase();

  if (!email) {
    redirect("/forgot-password");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020b1a] px-4 text-white">
      <ResetPasswordForm
        email={email}
        sent={params.sent === "1"}
        devCode={params.devCode}
      />
    </main>
  );
}
