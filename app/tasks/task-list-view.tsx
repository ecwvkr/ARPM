"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleTask } from "@/app/actions/tasks";
import { IconCircle, IconCircleCheckFilled, IconChevronRight } from "@tabler/icons-react";
import type { FlatTaskRow } from "@/lib/tasks";

// 리스트 뷰: 태스크 1건 = 1행. 파트너·프로젝트·작성자 열은 값이 반복되는 경우가 많아
// 캐럿으로 접어(열 숨김) 태스크에 집중할 수 있게 한다.
// 좁은 화면에서는 가로 스크롤 테이블 대신 카드 목록으로 바꿔 보여준다(모바일 최적화).
export function TaskListView({ rows }: { rows: FlatTaskRow[] }) {
  const [showPartner, setShowPartner] = useState(true);
  const [showProject, setShowProject] = useState(true);
  const [showAuthor, setShowAuthor] = useState(true);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">열 표시</span>
        <ColumnToggle label="파트너" open={showPartner} onToggle={() => setShowPartner((v) => !v)} />
        <ColumnToggle label="프로젝트" open={showProject} onToggle={() => setShowProject((v) => !v)} />
        <ColumnToggle label="작성자" open={showAuthor} onToggle={() => setShowAuthor((v) => !v)} />
      </div>

      <div className="space-y-1.5 sm:hidden">
        {rows.map((row, i) => (
          <TaskCardRow
            key={row.task.id}
            index={i + 1}
            row={row}
            showPartner={showPartner}
            showProject={showProject}
            showAuthor={showAuthor}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-4xl bg-card shadow-md ring-1 ring-foreground/5 sm:block dark:ring-foreground/10">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-xs text-muted-foreground">
              <th className="w-10 px-4 py-3 text-right font-medium">#</th>
              {showPartner && <th className="px-4 py-3 font-medium">파트너</th>}
              {showProject && <th className="px-4 py-3 font-medium">프로젝트</th>}
              <th className="px-4 py-3 font-medium">태스크</th>
              {showAuthor && <th className="px-4 py-3 font-medium">작성자</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <TaskTableRow
                key={row.task.id}
                index={i + 1}
                row={row}
                showPartner={showPartner}
                showProject={showProject}
                showAuthor={showAuthor}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColumnToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      className={`flex items-center gap-0.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        open ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {label}
      <IconChevronRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
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

function TaskCardRow({
  index,
  row,
  showPartner,
  showProject,
  showAuthor,
}: {
  index: number;
  row: FlatTaskRow;
  showPartner: boolean;
  showProject: boolean;
  showAuthor: boolean;
}) {
  const { task } = row;
  const { isPending, toggle } = useTaskToggle(task.id);

  const metaParts: React.ReactNode[] = [];
  if (showPartner) metaParts.push(row.partnerName);
  if (showProject) {
    metaParts.push(
      <Link key="project" href={`/partners/${row.partnerId}?project=${row.projectId}`} className="hover:underline">
        {row.projectTitle}
      </Link>,
    );
  }
  if (showAuthor) metaParts.push(task.createdByName);

  return (
    <div className="flex items-start gap-2 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
      <span className="mt-0.5 w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index}</span>
      <span className="mt-0.5">
        <TaskCheckButton done={task.done} isPending={isPending} onClick={toggle} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm break-words ${task.done ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
        {metaParts.length > 0 && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            {metaParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>·</span>}
                {part}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

function TaskTableRow({
  index,
  row,
  showPartner,
  showProject,
  showAuthor,
}: {
  index: number;
  row: FlatTaskRow;
  showPartner: boolean;
  showProject: boolean;
  showAuthor: boolean;
}) {
  const { task } = row;
  const { isPending, toggle } = useTaskToggle(task.id);

  return (
    <tr className="border-b border-foreground/5 last:border-0 hover:bg-muted/40">
      <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">{index}</td>
      {showPartner && <td className="max-w-32 truncate px-4 py-2 text-muted-foreground">{row.partnerName}</td>}
      {showProject && (
        <td className="max-w-40 truncate px-4 py-2">
          <Link
            href={`/partners/${row.partnerId}?project=${row.projectId}`}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            {row.projectTitle}
          </Link>
        </td>
      )}
      <td className="min-w-40 px-4 py-2">
        <div className="flex items-center gap-2">
          <TaskCheckButton done={task.done} isPending={isPending} onClick={toggle} />
          <span className={task.done ? "text-muted-foreground line-through" : ""}>{task.title}</span>
        </div>
      </td>
      {showAuthor && <td className="max-w-24 truncate px-4 py-2 text-muted-foreground">{task.createdByName}</td>}
    </tr>
  );
}
