import { auth } from "@/auth";
import { getPostLoginRedirect } from "@/lib/authRedirect";
import { redirect } from "next/navigation";

export default async function PainelPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(getPostLoginRedirect(session.user.role));
}
