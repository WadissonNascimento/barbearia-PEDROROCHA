import Link from "next/link";
import AuthFormMessage from "@/components/AuthFormMessage";
import ReliableSubmitButton from "@/components/ReliableSubmitButton";

export default function AdminLoginForm({
  errorMessage = null,
}: {
  errorMessage?: string | null;
}) {
  return (
    <form
      action="/admin/login/submit"
      method="post"
      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"
    >
      <h1 className="text-3xl font-bold">Login do admin</h1>
      <p className="mt-2 text-zinc-400">
        Entre com um usuario administrador cadastrado no banco.
      </p>

      <div className="mt-6">
        <AuthFormMessage message={errorMessage} />
      </div>

      <div className="space-y-4">
        <input
          name="email"
          type="email"
          placeholder="E-mail"
          className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-white outline-none"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Senha"
          className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-white outline-none"
          required
        />
      </div>

      <div className="mt-5">
        <ReliableSubmitButton
          idleText="Entrar no admin"
          loadingText="Entrando..."
        />
      </div>

      <p className="mt-5 text-sm text-zinc-400">
        Se preferir, você também pode usar o login comum em{" "}
        <Link href="/login" className="text-sky-300 hover:underline">
          /login
        </Link>
        .
      </p>
    </form>
  );
}
