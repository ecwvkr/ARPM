"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleTask } from "@/app/actions/tasks";
import { IconCircle, IconCircleCheckFilled, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { FlatTaskRow } from "@/lib/tasks";

// 열 머리글의 캐럿으로 그 자리에서 접어(값만 숨김) 태스크에 집중할 수 있게 한다.
// 태스크 열은 이 화면의 본체라 접을 수 없다.
const COLUMNS = [
  { key: "partner", label: "파트너" },
  { key: "project", label: "프로젝트" },
  { key: "task", label: "태스크" },
  { key: "author", label: "작성자" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
type CollapsedMap = Partial<Record<ColumnKey, boolean>>;

// 리스트 뷰: 태스크 1건 = 1행. 좁은 화면에서는 가로 스크롤 테이블 대신 카드 목록으로 바꾼다.
export function TaskListView({ rows }: { rows: FlatTaskRow[] }) {
  const [collapsed, setCollapsed] = useState<CollapsedMap>({});

  // 접힌 열은 원래 자리(표 가운데)에 남겨두면 라벨만 둥둥 떠 보이므로 왼쪽으로 모아 정리한다.
  // sort는 안정 정렬이라 접힌 것끼리·펼친 것끼리의 원래 순서는 그대로 유지된다.
  const orderedColumns = [...COLUMNS].sort(
    (a, b) => Number(!!collapsed[b.key]) - Number(!!collapsed[a.key]),
  );

  function toggle(key: ColumnKey) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5 sm:hidden">
        {rows.map((row, i) => (
          <TaskCardRow key={row.task.id} index={i + 1} row={row} />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-4xl bg-card shadow-md ring-1 ring-foreground/5 sm:block dark:ring-foreground/10">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-xs text-muted-foreground">
              <th className="w-10 px-4 py-3 text-right font-medium">#</th>
              {orderedColumns.map((col) =>
                col.key === "task" ? (
                  <th key={col.key} className="px-4 py-3 font-medium">
                    {col.label}
                  </th>
                ) : (
                  <CollapsibleHeader
                    key={col.key}
                    label={col.label}
                    open={!collapsed[col.key]}
                    onToggle={() => toggle(col.key)}
                  />
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <TaskTableRow
                key={row.task.id}
                index={i + 1}
                row={row}
                columns={orderedColumns}
                collapsed={collapsed}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 접힌 열은 머리글만 흐리게 남기고 값을 비워, 다시 펼 자리를 잃지 않게 한다.
function CollapsibleHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <th className={`py-3 font-medium ${open ? "px-4" : "w-px px-2"}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${label} 열 ${open ? "접기" : "펼치기"}`}
        className={`flex items-center gap-0.5 whitespace-nowrap hover:text-foreground ${
          open ? "" : "text-muted-foreground/50"
        }`}
      >
        {label}
        {open ? <IconChevronLeft className="size-3.5" /> : <IconChevronRight className="size-3.5" />}
      </button>
    </th>
  );
}

function useTaskToggle(taskId: string) {
  const [isPending, startTransition] = useTransition();
  function toggle() {
    startTransition(async () => {
      try {
        await toggleTask(taskId);
      } catch {
        alert("변경할 수 없습니다. 권한을 확인하세요.");
      }
    });
  }
  return { isPending, toggle };
}

function TaskCheckButton({ done, isPending, onClick }: { done: boolean; isPending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={done ? "완료 취소" : "완료 처리"}
      onClick={onClick}
      className={`shrink-0 ${done ? "text-primary" : "text-muted-foreground"}`}
    >
      {done ? <IconCircleCheckFilled className="size-4" /> : <IconCircle className="size-4" />}
    </button>
  );
}

// 모바일 카드에는 열 머리글이 없어 접을 대상이 없으므로 항상 전체 정보를 함께 보여준다.
function TaskCardRow({ index, row }: { index: number; row: FlatTaskRow }) {
  const { task } = row;
  const { isPending, toggle } = useTaskToggle(task.id);
  const doneRow = task.done ? "text-muted-foreground line-through" : "";

  return (
    <div
      className={`flex items-start gap-2 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10 ${doneRow}`}
    >
      <span className="mt-0.5 w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index}</span>
      <span className="mt-0.5 no-underline">
        <TaskCheckButton done={task.done} isPending={isPending} onClick={toggle} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm break-words">{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          <span>{row.partnerName}</span>
          <span aria-hidden>·</span>
          <Link href={`/partners/${row.partnerId}?project=${row.projectId}`} className="hover:underline">
            {row.projectTitle}
          </Link>
          <span aria-hidden>·</span>
          <span>{task.createdByName}</span>
        </p>
      </div>
    </div>
  );
}

function TaskTableRow({
  index,
  row,
  columns,
  collapsed,
}: {
  index: number;
  row: FlatTaskRow;
  columns: readonly { key: ColumnKey; label: string }[];
  collapsed: CollapsedMap;
}) {
  const { task } = row;
  const { isPending, toggle } = useTaskToggle(task.id);

  // 완료 행은 행 전체를 회색 + 취소선으로 처리한다(체크 버튼만 예외 — 다시 눌러야 하므로).
  const doneRow = task.done ? "text-muted-foreground line-through" : "";

  function renderCell(key: ColumnKey) {
    const isCollapsed = !!collapsed[key];
    const pad = isCollapsed ? "px-2" : "px-4";

    switch (key) {
      case "partner":
        return (
          <td key={key} className={`truncate py-2 text-muted-foreground ${isCollapsed ? pad : `max-w-32 ${pad}`}`}>
            {isCollapsed ? null : row.partnerName}
          </td>
        );
      case "project":
        return (
          <td key={key} className={`truncate py-2 ${isCollapsed ? pad : `max-w-40 ${pad}`}`}>
            {isCollapsed ? null : (
              <Link
                href={`/partners/${row.partnerId}?project=${row.projectId}`}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                {row.projectTitle}
              </Link>
            )}
          </td>
        );
      case "author":
        return (
          <td key={key} className={`truncate py-2 text-muted-foreground ${isCollapsed ? pad : `max-w-24 ${pad}`}`}>
            {isCollapsed ? null : task.createdByName}
          </td>
        );
      case "task":
        return (
          <td key={key} className="min-w-40 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="no-underline">
                <TaskCheckButton done={task.done} isPending={isPending} onClick={toggle} />
              </span>
              <span>{task.title}</span>
            </div>
          </td>
        );
    }
  }

  return (
    <tr className={`border-b border-foreground/5 last:border-0 hover:bg-muted/40 ${doneRow}`}>
      <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">{index}</td>
      {columns.map((col) => renderCell(col.key))}
    </tr>
  );
}
