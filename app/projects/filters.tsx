"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { ProjectSortSelect } from "./project-sort-select";
import { chipClass, toArray } from "@/lib/ui";
import { saveFilter, deleteSavedFilter } from "@/app/actions/filters";
import { IconSearch, IconBookmark, IconUser } from "@tabler/icons-react";

const STATUS_OPTIONS = [
  { value: "TODO", label: "진행전" },
  { value: "IN_PROGRESS", label: "진행중" },
  { value: "DONE", label: "완료" },
];

const DUE_OPTIONS = [
  { value: "OVERDUE", label: "지연" },
  { value: "TODAY", label: "오늘" },
  { value: "WEEK", label: "이번주" },
  { value: "NONE", label: "마감일 없음" },
];

export function ProjectFilters({
  partners,
  assignees,
  currentUserId,
  savedFilters,
}: {
  partners: { id: string; name: string }[];
  assignees: { id: string; name: string }[];
  currentUserId: string;
  savedFilters: { id: string; name: string; query: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    // f=1: 필터를 한 번이라도 직접 건드렸다는 표시. 이게 있어야 담당자 필터를
    // 전부 해제해 빈 배열이 됐을 때도(요청 13의 기본값과 URL이 똑같이 "없음"이라
    // 서버가 다시 기본값(내 프로젝트)을 되살리지 않는다.
    params.set("f", "1");
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/projects?${params.toString()}`);
  }

  function setArrayParam(key: string, values: string[]) {
    setParam(key, values.join(","));
  }

  // 검색은 타이핑 멈춘 뒤 0.3초에 자동 적용한다.
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (queryInput.trim() !== current) setParam("q", queryInput.trim());
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  // 저장된 필터 적용, 네비게이션 등 입력창 밖에서 q가 바뀌면 입력창도 맞춰준다.
  // (렌더 중 상태 조정 — https://react.dev/learn/you-might-not-need-an-effect)
  const currentQ = searchParams.get("q") ?? "";
  const [syncedQ, setSyncedQ] = useState(currentQ);
  if (currentQ !== syncedQ) {
    setSyncedQ(currentQ);
    setQueryInput(currentQ);
  }

  const selectedPartners = toArray(searchParams.get("partners"));
  const selectedStatuses = toArray(searchParams.get("status"));
  // page.tsx의 기본값 로직과 맞춘다 — f 없이 assignee도 없는 순수 진입이면
  // "내 프로젝트" 칩이 눌린 상태로 보여야 실제 필터링 결과와 화면이 일치한다.
  const rawAssignee = searchParams.get("assignee");
  const touched = searchParams.get("f") !== null;
  const selectedAssignees = rawAssignee !== null ? toArray(rawAssignee) : touched ? [] : [currentUserId];
  const selectedDue = toArray(searchParams.get("due"));
  const mine = selectedAssignees.includes(currentUserId);

  function toggleMine() {
    setArrayParam(
      "assignee",
      mine ? selectedAssignees.filter((id) => id !== currentUserId) : [...selectedAssignees, currentUserId],
    );
  }

  // 요청 12: 파트너·담당자 선택지는 가나다순, 담당자 중 본인은 항상 맨 위에 고정.
  const partnerOptions = [...partners]
    .map((p) => ({ value: p.id, label: p.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const assigneeOptions = [...assignees]
    .map((a) => ({ value: a.id, label: a.id === currentUserId ? `${a.name} (나)` : a.name }))
    .sort((a, b) => {
      if (a.value === currentUserId) return -1;
      if (b.value === currentUserId) return 1;
      return a.label.localeCompare(b.label, "ko");
    });

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
        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="프로젝트명·담당자 검색"
            aria-label="프로젝트명·담당자 검색"
            className="h-auto w-48 py-1.5 pl-8 text-sm"
          />
        </div>

        <MultiSelectFilter
          label="파트너"
          options={partnerOptions}
          selected={selectedPartners}
          onChange={(v) => setArrayParam("partners", v)}
        />
        <MultiSelectFilter
          label="상태"
          options={STATUS_OPTIONS}
          selected={selectedStatuses}
          onChange={(v) => setArrayParam("status", v)}
        />
        <MultiSelectFilter
          label="담당자"
          options={assigneeOptions}
          selected={selectedAssignees}
          onChange={(v) => setArrayParam("assignee", v)}
        />
        <MultiSelectFilter
          label="마감일"
          options={DUE_OPTIONS}
          selected={selectedDue}
          onChange={(v) => setArrayParam("due", v)}
        />

        <button type="button" onClick={toggleMine} aria-pressed={mine} className={chipClass(mine, "flex items-center gap-1")}>
          <IconUser className="size-3.5" />내 프로젝트
        </button>

        <ProjectSortSelect />

        <Popover>
          <PopoverTrigger
            render={
              <Button type="button" size="sm" variant="outline">
                <IconBookmark className="size-3.5" />
                필터
              </Button>
            }
          />
          <PopoverContent className="w-64 gap-2 p-2" align="start">
            <Button type="button" size="sm" variant="ghost" onClick={handleSave} disabled={isPending} className="justify-start">
              + 현재 필터 저장
            </Button>
            {savedFilters.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">저장된 필터가 없습니다.</p>
            ) : (
              <ul className="space-y-0.5">
                {savedFilters.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams(f.query);
                        params.set("f", "1");
                        router.push(`/projects?${params.toString()}`);
                      }}
                      className="truncate text-left text-sm"
                    >
                      {f.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`${f.name} 삭제`}
                      onClick={() => startTransition(async () => { await deleteSavedFilter(f.id); })}
                      className="shrink-0 text-muted-foreground/60 hover:text-destructive"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
