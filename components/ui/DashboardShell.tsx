export default function DashboardShell({
  children,
  className = "",
  size = "default",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "narrow" | "default" | "wide";
}) {
  const sizeClass =
    size === "narrow"
      ? "dashboard-shell-narrow"
      : size === "wide"
      ? "dashboard-shell-wide"
      : "";

  return (
    <div className={`dashboard-shell ${sizeClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
