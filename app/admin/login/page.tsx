import AdminLoginForm from "@/components/AdminLoginForm";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
  }>;
}) {
  const errorMessage = (await searchParams)?.error || null;

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-16">
      <AdminLoginForm errorMessage={errorMessage} />
    </section>
  );
}
