import { Crown } from "lucide-react";

export default function CrownRating({
  rating,
  size = "md",
  interactive = false,
  disabled = false,
  onSelect,
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  disabled?: boolean;
  onSelect?: (rating: number) => void;
}) {
  const iconSize = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }[size];

  const items = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1.5" aria-label={`${rating} de 5 coroas`}>
      {items.map((value) => {
        const selected = value <= rating;
        const className = `${iconSize} transition ${
          selected
            ? "fill-[var(--brand)] text-[var(--brand)]"
            : "fill-black text-black"
        }`;

        if (interactive) {
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect?.(value)}
              disabled={disabled}
              aria-label={`${value} ${value === 1 ? "coroa" : "coroas"}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-2 transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Crown aria-hidden="true" className={className} strokeWidth={2.1} />
            </button>
          );
        }

        return (
          <Crown
            key={value}
            aria-hidden="true"
            className={className}
            strokeWidth={2.1}
          />
        );
      })}
    </div>
  );
}
