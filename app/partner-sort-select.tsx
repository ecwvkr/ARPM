"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "activity", label: "최근 활동순" },
  { value: "name", label: "이름순" },
  { value: "created", label: "생성일순" },
];

export function PartnerSortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={searchParams.get("sort") ?? "activity"}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", e.target.value);
        router.push(`/?${params.toString()}`);
      }}
      aria-label="파트너 정렬"
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
