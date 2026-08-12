"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chipClass } from "@/lib/ui";

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const active = selected.length > 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button type="button" className={chipClass(active)}>
            {label}
            {active && ` (${selected.length})`}
          </button>
        }
      />
      <PopoverContent className="w-48 gap-0.5 p-1.5" align="start">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(checked ? selected.filter((v) => v !== o.value) : [...selected, o.value])
                }
                className="size-3.5 accent-primary"
              />
              {o.label}
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
