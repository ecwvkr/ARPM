"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function TaskFilters({ projects }: { projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tagInput, setTagInput] = useState(searchParams.get("tag") ?? "");
  const [queryInput, setQueryInput] = useState(searchParams.get("q") ?? "");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/tasks?${params.toString()}`);
  }

  const mine = searchParams.get("mine") === "1";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={queryInput}
        onChange={(e) => setQueryInput(e.target.value)}
        onBlur={() => setParam("q", queryInput.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", queryInput.trim());
        }}
        placeholder="업무명 검색"
        aria-label="업무명 검색"
        className="h-auto w-40 py-1.5 text-sm"
      />

      <select
        value={searchParams.get("projectId") ?? ""}
        onChange={(e) => setParam("projectId", e.target.value)}
        aria-label="프로젝트 필터"
        className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
      >
        <option value="">전체 프로젝트</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        aria-label="상태 필터"
        className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
      >
        <option value="">전체 상태</option>
        <option value="TODO">진행전</option>
        <option value="IN_PROGRESS">진행중</option>
        <option value="DONE">종료</option>
      </select>

      <Input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onBlur={() => setParam("tag", tagInput.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("tag", tagInput.trim());
        }}
        placeholder="태그로 검색"
        className="h-auto w-32 py-1.5 text-sm"
      />

      <button
        type="button"
        onClick={() => setParam("mine", mine ? "" : "1")}
        aria-pressed={mine}
        className={
          mine
            ? "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            : "rounded-md border border-input px-3 py-1.5 text-sm"
        }
      >
        내 업무
      </button>
    </div>
  );
}
