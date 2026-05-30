export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  variant = "panel",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  variant?: "panel" | "plain";
}) {
  const sectionClass =
    variant === "plain"
      ? "mb-5 flex flex-col gap-4 py-2 sm:mb-6 lg:flex-row lg:items-start lg:justify-between"
      : "dashboard-panel mb-5 flex flex-col gap-4 p-4 sm:mb-6 sm:p-6 lg:flex-row lg:items-start lg:justify-between";

  return (
    <section className={sectionClass}>
      <div className="min-w-0 max-w-3xl space-y-2">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            {eyebrow}
          </p>
        )}
        <h1 className="break-words text-3xl font-bold text-white sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-6 text-zinc-400 sm:text-[15px]">
            {description}
          </p>
        )}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-3 sm:justify-start lg:justify-end">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
