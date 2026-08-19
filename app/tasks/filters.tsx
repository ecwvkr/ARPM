"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chipClass, toArray } from "@/lib/ui";
import { IconSearch, IconUser } from "@tabler/icons-react";

// 전체 프로젝트 화면 상단 필터(app/projects/filters.tsx)를 참고해 검색·파트너 필터를
// 그대로 가져왔다. "내 태스크"는 단순 on/off 대신 "전체"+사용자 목록에서 하나를 골라
// 그 사람이 등록한(=담당자) 태스크만 보는 단일 선택 필터다.
export function TaskFilters({
  partners,
  users,
  currentUserId,
  selectedAuthorId,
}: {
  partners: { id: string; name: string }[];
  users: { id: string; name: string }[];
  currentUserId: string;
  selectedAuthorId: string; // "all" | userId (없으면 페이지에서 currentUserId로 기본 채워 넘긴다)
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState(searchParams.get("q") ?? "");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/tasks?${params.toString()}`);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (queryInput.trim() !== current) setParam("q", queryInput.trim());
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  const currentQ = searchParams.get("q") ?? "";
  const [syncedQ, setSyncedQ] = useState(currentQ);
  if (currentQ !== syncedQ) {
    setSyncedQ(currentQ);
    setQueryInput(currentQ);
  }

  const selectedPartners = toArray(searchParams.get("partners"));
  const partnerOptions = [...partners]
    .map((p) => ({ value: p.id, label: p.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="태스크·프로젝트명 검색"
          aria-label="태스크·프로젝트명 검색"
          className="h-auto w-48 py-1.5 pl-8 text-sm"
        />
      </div>

      <MultiSelectFilter
        label="파트너"
        options={partnerOptions}
        selected={selectedPartners}
        onChange={(v) => setParam("partners", v.join(","))}
      />

      <AuthorFilter
        users={users}
        currentUserId={currentUserId}
        selectedAuthorId={selectedAuthorId}
        onSelect={(id) => setParam("author", id)}
      />
    </div>
  );
}

function AuthorFilter({
  users,
  currentUserId,
  selectedAuthorId,
  onSelect,
}: {
  users: { id: string; name: string }[];
  currentUserId: string;
  selectedAuthorId: string;
  onSelect: (id: string) => void;
}) {
  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return a.name.localeCompare(b.name, "ko");
  });

  const label =
    selectedAuthorId === "all"
      ? "전체"
      : selectedAuthorId === currentUserId
        ? "내 태스크"
        : (users.find((u) => u.id === selectedAuthorId)?.name ?? "내 태스크");

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button type="button" className={chipClass(selectedAuthorId !== "all", "flex items-center gap-1")}>
            <IconUser className="size-3.5" />
            {label}
          </button>
        }
      />
      <PopoverContent className="w-44 gap-0.5 p-1.5" align="start">
        <button
          type="button"
          onClick={() => onSelect("all")}
          className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
            selectedAuthorId === "all" ? "font-medium" : "text-muted-foreground"
          }`}
        >
          전체
        </button>
        {sortedUsers.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onSelect(u.id)}
            className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
              selectedAuthorId === u.id ? "font-medium" : "text-muted-foreground"
            }`}
          >
            {u.id === currentUserId ? `${u.name} (나)` : u.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
