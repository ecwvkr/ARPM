"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

// 후보가 많아지면 드롭다운을 스크롤하며 찾기보다 이름으로 검색해 고르는 편이 빠르다.
// 선택값은 hidden input(name)으로 폼에 실려 서버 액션에서 그대로 읽힌다.
export function ProjectParentPicker({
  name,
  options,
  defaultId,
  placeholder = "상위 프로젝트 검색",
}: {
  name: string;
  options: { id: string; title: string }[];
  defaultId?: string | null;
  placeholder?: string;
}) {
  const defaultOption = options.find((o) => o.id === defaultId) ?? null;
  const [selectedId, setSelectedId] = useState(defaultId ?? "");
  const [query, setQuery] = useState(defaultOption?.title ?? "");
  const [open, setOpen] = useState(false);

  const filtered = query.trim()
    ? options.filter((o) => o.title.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function select(id: string, title: string) {
    setSelectedId(id);
    setQuery(title);
    setOpen(false);
  }

  function clear() {
    setSelectedId("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selectedId} />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border-[0.5px] bg-popover p-1 text-sm shadow-lg">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-muted"
          >
            (없음)
          </button>
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">검색 결과가 없습니다.</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(o.id, o.title)}
                className={`flex w-full items-center rounded-md px-2 py-1.5 text-left hover:bg-muted ${
                  o.id === selectedId ? "font-medium" : ""
                }`}
              >
                {o.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
