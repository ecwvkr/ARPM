"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveFilter, deleteSavedFilter } from "@/app/actions/filters";

export function TaskFilters({
  projects,
  savedFilters,
}: {
  projects: { id: string; name: string }[];
  savedFilters: { id: string; name: string; query: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/tasks?${params.toString()}`);
  }

  const mine = searchParams.get("mine") === "1";

  function handleSave() {
    const name = window.prompt("즐겨찾기 이름");
    if (!name) return;
    startTransition(async () => {
      await saveFilter(name, searchParams.toString());
    });
  }

  return (
    <div className="space-y-2">
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
        <option value="DONE">완료</option>
      </select>

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

      <Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={isPending}>
        현재 필터 저장
      </Button>
    </div>

    {savedFilters.length > 0 && (
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>즐겨찾기:</span>
        {savedFilters.map((f) => (
          <span key={f.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <button type="button" onClick={() => router.push(`/tasks?${f.query}`)}>
              {f.name}
            </button>
            <button
              type="button"
              aria-label={`${f.name} 삭제`}
              onClick={() => startTransition(async () => { await deleteSavedFilter(f.id); })}
              className="text-muted-foreground/60 hover:text-destructive"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    )}
    </div>
  );
}
