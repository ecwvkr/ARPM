"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { ProjectSortSelect } from "./project-sort-select";
import { chipClass, toArray } from "@/lib/ui";
import { saveFilter, deleteSavedFilter } from "@/app/actions/filters";
import { IconSearch, IconFilter, IconX, IconUser } from "@tabler/icons-react";

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

// 검색·파트너·상태·담당자·마감일·내 프로젝트·정렬·즐겨찾기를 한 줄에 늘어놓았더니
// 좁은 화면에서 세 줄을 차지하고, 정작 목록은 화면 밖으로 밀렸다.
//
// 늘 보이는 것은 검색창과 '필터' 버튼 둘뿐이다. 나머지는 필터 창 안으로 넣고, 켜져
// 있는 조건만 아래에 알약으로 되돌려 보여 준다 — 무엇이 걸려 있는지는 보이되, 안
// 쓸 때는 자리를 차지하지 않는다.
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
  const [open, setOpen] = useState(false);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    // f=1: 필터를 한 번이라도 직접 건드렸다는 표시. 이게 있어야 담당자 필터를
    // 전부 해제해 빈 배열이 됐을 때도(요청 13의 기본값과 URL이 똑같이 "없음"이라)
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
  const sort = searchParams.get("sort") ?? "";
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

  const labelOf = (options: { value: string; label: string }[], value: string) =>
    options.find((o) => o.value === value)?.label ?? value;

  // 켜져 있는 조건을 하나씩 알약으로 되돌려 보여 준다. 필터 창을 열지 않아도 지금
  // 무엇이 걸려 있는지 알 수 있어야 결과를 오해하지 않는다.
  const activeChips: { key: string; label: string; remove: () => void }[] = [
    ...selectedPartners.map((v) => ({
      key: `partner-${v}`,
      label: labelOf(partnerOptions, v),
      remove: () => setArrayParam("partners", selectedPartners.filter((x) => x !== v)),
    })),
    ...selectedStatuses.map((v) => ({
      key: `status-${v}`,
      label: labelOf(STATUS_OPTIONS, v),
      remove: () => setArrayParam("status", selectedStatuses.filter((x) => x !== v)),
    })),
    ...selectedAssignees.map((v) => ({
      key: `assignee-${v}`,
      label: labelOf(assigneeOptions, v),
      remove: () => setArrayParam("assignee", selectedAssignees.filter((x) => x !== v)),
    })),
    ...selectedDue.map((v) => ({
      key: `due-${v}`,
      label: labelOf(DUE_OPTIONS, v),
      remove: () => setArrayParam("due", selectedDue.filter((x) => x !== v)),
    })),
  ];
  const activeCount = activeChips.length + (sort ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="프로젝트명·담당자 검색"
            aria-label="프로젝트명·담당자 검색"
            className="h-auto w-full py-1.5 pl-8 text-sm"
          />
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button type="button" size="sm" variant={activeCount > 0 ? "default" : "outline"} className="shrink-0">
                <IconFilter className="size-3.5" />
                필터
                {activeCount > 0 && <span className="tabular-nums">{activeCount}</span>}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>필터</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
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
                <button
                  type="button"
                  onClick={toggleMine}
                  aria-pressed={mine}
                  className={chipClass(mine, "flex items-center gap-1")}
                >
                  <IconUser className="size-3.5" />내 프로젝트
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-foreground/10 pt-3">
                <span className="text-xs text-muted-foreground">정렬</span>
                <ProjectSortSelect />
              </div>

              <div className="space-y-1.5 border-t border-foreground/10 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">즐겨찾기</span>
                  <Button type="button" size="sm" variant="ghost" onClick={handleSave} disabled={isPending}>
                    + 현재 필터 저장
                  </Button>
                </div>
                {savedFilters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">저장된 필터가 없습니다.</p>
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
                            setOpen(false);
                          }}
                          className="min-w-0 flex-1 truncate text-left text-sm"
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
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(activeChips.length > 0 || sort) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.remove}
              aria-label={`${chip.label} 필터 해제`}
              className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/70"
            >
              {chip.label}
              <IconX className="size-3" />
            </button>
          ))}
          {sort && (
            <button
              type="button"
              onClick={() => setParam("sort", "")}
              aria-label="정렬 해제"
              className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/70"
            >
              정렬
              <IconX className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push("/projects?f=1")}
            className="px-1 text-xs text-muted-foreground underline underline-offset-2"
          >
            초기화
          </button>
        </div>
      )}
    </div>
  );
}
