"use client";

import { useEffect, useState } from "react";

const WIDTHS: Record<string, string> = {
  wide: "max-w-none",
  tablet: "max-w-3xl",
  phone: "max-w-sm",
};

const LABELS: Record<string, string> = {
  wide: "넓게",
  tablet: "패드",
  phone: "폰",
};

export function WidthContainer({
  children,
  mainClassName = "",
}: {
  children: React.ReactNode;
  mainClassName?: string;
}) {
  const [width, setWidth] = useState("wide");

  useEffect(() => {
    const stored = localStorage.getItem("arpm-width");
    // ponytail: hydration-safe localStorage read, not state derived from props
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored && WIDTHS[stored]) setWidth(stored);
  }, []);

  function choose(w: string) {
    setWidth(w);
    localStorage.setItem("arpm-width", w);
  }

  return (
    <>
      <div className="hidden justify-end gap-2 px-6 py-1.5 text-xs text-muted-foreground shadow-sm lg:flex">
        {Object.keys(WIDTHS).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => choose(w)}
            aria-pressed={width === w}
            className={
              width === w
                ? "font-medium text-foreground underline underline-offset-2"
                : "underline underline-offset-2"
            }
          >
            {LABELS[w]}
          </button>
        ))}
      </div>
      <main className={`mx-auto w-full flex-1 ${WIDTHS[width]} ${mainClassName}`}>
        {children}
      </main>
    </>
  );
}
