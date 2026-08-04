"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function TaskFilters({ projects }: { projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/tasks?${params.toString()}`);
  }

  const mine = searchParams.get("mine") === "1";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={searchParams.get("projectId") ?? ""}
        onChange={(e) => setParam("projectId", e.target.value)}
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
        className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
      >
        <option value="">전체 상태</option>
        <option value="TODO">진행전</option>
        <option value="IN_PROGRESS">진행중</option>
        <option value="DONE">종료</option>
      </select>

      <button
        type="button"
        onClick={() => setParam("mine", mine ? "" : "1")}
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
