export default function SectionCard({
  id,
  title,
  description,
  children,
  actions,
  className = "",
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`surface-card overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,23,36,0.96),rgba(10,14,24,0.98))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-white sm:text-[1.35rem]">{title}</h2>
          {description && <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>}
        </div>
        {actions}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}
