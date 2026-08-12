"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "", label: "기본 정렬" },
  { value: "due", label: "마감일 임박순" },
  { value: "recent", label: "최신순" },
  { value: "priority", label: "우선순위순" },
];

export function ProjectSortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={searchParams.get("sort") ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set("sort", e.target.value);
        else params.delete("sort");
        router.push(`/projects?${params.toString()}`);
      }}
      aria-label="정렬"
      className="rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-xs"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
