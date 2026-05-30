import { auth } from "@/auth";
import { getPostLoginRedirect } from "@/lib/authRedirect";
import { redirect } from "next/navigation";

export default async function RedirecionarPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(getPostLoginRedirect(session.user.role));
}
