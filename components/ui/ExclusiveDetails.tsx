"use client";

import type { DetailsHTMLAttributes, ReactNode } from "react";

type ExclusiveDetailsProps = Omit<
  DetailsHTMLAttributes<HTMLDetailsElement>,
  "children"
> & {
  group: string;
  children: ReactNode;
};

export default function ExclusiveDetails({
  group,
  children,
  onToggle,
  ...props
}: ExclusiveDetailsProps) {
  return (
    <details
      {...props}
      data-exclusive-details={group}
      onToggle={(event) => {
        onToggle?.(event);

        const current = event.currentTarget;
        if (!current.open) {
          return;
        }

        const selector = `details[data-exclusive-details="${CSS.escape(group)}"]`;
        document.querySelectorAll<HTMLDetailsElement>(selector).forEach((details) => {
          if (details !== current) {
            details.open = false;
          }
        });
      }}
    >
      {children}
    </details>
  );
}
