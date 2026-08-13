"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, isOverdue, type ParticipantChipData } from "@/lib/priority";
import { ProjectCard } from "@/app/partners/[partnerId]/project-card";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const VIEWS = [
  { key: "day", label: "일간 뷰" },
  { key: "week", label: "주간 뷰" },
  { key: "month", label: "월간 뷰" },
] as const;

export type CalendarView = (typeof VIEWS)[number]["key"];

export type CalendarProject = {
  id: string;
  partnerId: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  visibility: "PUBLIC" | "PRIVATE";
  dueDate: Date | null;
  createdAt: Date;
  partnerName: string;
  partnerColor: string | null;
  participants: ParticipantChipData[];
  commentCount: number;
  links: string[];
  unread: boolean;
};

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(d.getDate() + n);
  return next;
}

function startOfWeek(d: Date) {
  return addDays(d, -d.getDay());
}

function monthGrid(year: number, month: number) {
  const gridStart = startOfWeek(new Date(year, month, 1));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function ProjectChip({ project, compact = false }: { project: CalendarProject; compact?: boolean }) {
  return (
    <Link
      href={`/partners/${project.partnerId}?project=${project.id}`}
      style={project.partnerColor ? { borderLeftColor: project.partnerColor } : undefined}
      className={`block truncate rounded-md px-1.5 py-0.5 text-xs ${
        project.partnerColor ? "border-l-2" : ""
      } ${
        isOverdue(project.dueDate, project.status)
          ? "bg-destructive/15 text-destructive"
          : "bg-secondary text-secondary-foreground"
      }`}
      title={`${project.title} · ${project.partnerName} · ${STATUS_LABEL[project.status]}`}
    >
      {compact ? project.title : `${project.title} · ${project.partnerName}`}
    </Link>
  );
}

export function CalendarView({
  initialDate,
  initialView,
  projects,
  currentUserId,
}: {
  initialDate: string;
  initialView: CalendarView;
  projects: CalendarProject[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>(initialView);
  const [cursor, setCursor] = useState(() => new Date(`${initialDate}T00:00:00`));
  const [selectedKey, setSelectedKey] = useState(initialDate);

  const cursorKey = dateKey(cursor);

  useEffect(() => {
    router.replace(`/calendar?v=${view}&d=${cursorKey}`, { scroll: false });
  }, [view, cursorKey, router]);

  const projectsByDate = useMemo(() => {
    const map = new Map<string, CalendarProject[]>();
    for (const t of projects) {
      if (!t.dueDate) continue;
      const key = dateKey(new Date(t.dueDate));
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [projects]);

  const todayKey = dateKey(new Date());
  const weekStart = startOfWeek(cursor);
  // ponytail: 7·42개 Date 생성은 memo할 가치가 없다.
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthDays = monthGrid(cursor.getFullYear(), cursor.getMonth());
  // 일간은 커서 날짜를 가운데 두고 앞뒤 3일씩 총 7일을 띠로 보여준다.
  const dayStrip = Array.from({ length: 7 }, (_, i) => addDays(cursor, i - 3));

  function goToday() {
    setCursor(new Date());
    setSelectedKey(todayKey);
  }

  // 이미 오늘을 보고 있으면 누를 이유가 없으므로 비활성. 월간은 달이 맞더라도
  // 선택된 날이 오늘이어야 "오늘을 보고 있는" 상태다.
  const today = new Date();
  const onToday =
    view === "day"
      ? cursorKey === todayKey
      : view === "week"
        ? weekDays.some((d) => dateKey(d) === todayKey)
        : selectedKey === todayKey &&
          cursor.getFullYear() === today.getFullYear() &&
          cursor.getMonth() === today.getMonth();

  function go(delta: number) {
    if (view === "day") setCursor(addDays(cursor, delta));
    else if (view === "week") setCursor(addDays(cursor, delta * 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  const weekEnd = addDays(weekStart, 6);
  const title =
    view === "day"
      ? `${cursor.getMonth() + 1}월 ${cursor.getDate()}일 (${WEEKDAY[cursor.getDay()]})`
      : view === "week"
        ? `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`
        : `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;

  const dayProjects = projectsByDate.get(cursorKey) ?? [];
  const selectedProjects = projectsByDate.get(selectedKey) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={
              view === v.key
                ? "rounded-full bg-foreground px-3 py-1 font-medium text-background"
                : "rounded-full bg-muted px-3 py-1 text-muted-foreground"
            }
          >
            {v.label}
          </button>
        ))}
        <button
          type="button"
          onClick={goToday}
          disabled={onToday}
          className="ml-auto rounded-full px-3 py-1 text-muted-foreground underline underline-offset-2 disabled:no-underline disabled:opacity-40"
        >
          오늘로 돌아가기
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label={view === "day" ? "이전날" : view === "week" ? "이전주" : "이전달"}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ←
        </button>
        <h2 className="text-sm font-medium">{title}</h2>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label={view === "day" ? "다음날" : view === "week" ? "다음주" : "다음달"}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          →
        </button>
      </div>

      {view === "day" ? (
        <>
          <div className="grid grid-cols-7 gap-1 rounded-4xl bg-card p-2 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
            {dayStrip.map((d) => {
              const key = dateKey(d);
              const count = (projectsByDate.get(key) ?? []).length;
              const selected = key === cursorKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCursor(d)}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 ${
                    selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <span className={`text-xs ${selected ? "" : "text-muted-foreground"}`}>
                    {WEEKDAY[d.getDay()]}
                  </span>
                  <span className={`text-sm ${key === todayKey ? "font-bold" : ""}`}>{d.getDate()}</span>
                  <span
                    className={`text-xs ${
                      selected ? "" : count > 0 ? "text-foreground" : "text-muted-foreground/40"
                    }`}
                  >
                    {count > 0 ? `${count}건` : "-"}
                  </span>
                </button>
              );
            })}
          </div>

          {dayProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">이 날 마감인 프로젝트가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dayProjects.map((t) => (
                <ProjectCard
                  key={t.id}
                  projectId={t.id}
                  partnerId={t.partnerId}
                  title={t.title}
                  status={t.status}
                  visibility={t.visibility}
                  overdue={isOverdue(t.dueDate, t.status)}
                  createdAt={t.createdAt}
                  dueDate={t.dueDate}
                  participants={t.participants}
                  commentCount={t.commentCount}
                  currentUserId={currentUserId}
                  partnerName={t.partnerName}
                  partnerColor={t.partnerColor}
                  links={t.links}
                  unread={t.unread}
                />
              ))}
            </div>
          )}
        </>
      ) : view === "week" ? (
        // 주간은 하루당 한 줄이라 세로로 늘어나도 읽기 좋다 — 잘라내지 않고 전부 보여준다.
        <div className="divide-y divide-foreground/5 overflow-hidden rounded-4xl bg-card shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
          {weekDays.map((d, i) => {
            const key = dateKey(d);
            const rowProjects = projectsByDate.get(key) ?? [];
            return (
              <div key={key} className="flex gap-3 p-3">
                <div className="w-12 shrink-0 text-center">
                  <p className="text-xs text-muted-foreground">{WEEKDAY[i]}</p>
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${
                      key === todayKey ? "bg-primary font-medium text-primary-foreground" : ""
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-1 py-1">
                  {rowProjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60">-</p>
                  ) : (
                    rowProjects.map((t) => <ProjectChip key={t.id} project={t} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-4xl bg-card p-3 shadow-md ring-1 ring-foreground/5 sm:p-4 dark:ring-foreground/10">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs text-muted-foreground">
            {WEEKDAY.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((d) => {
              const key = dateKey(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const cellProjects = projectsByDate.get(key) ?? [];
              // 칸 높이를 고정하고 2건까지만 보여준 뒤 나머지는 개수로 접는다.
              // 전체는 아래 선택 패널에서 확인한다(칸이 늘어나 그리드가 흔들리지 않게).
              const visible = cellProjects.slice(0, 2);
              const overflow = cellProjects.length - visible.length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`h-24 overflow-hidden rounded-xl p-1 text-left ${inMonth ? "" : "opacity-40"} ${
                    key === selectedKey ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                      key === todayKey
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {visible.map((t) => (
                      <ProjectChip key={t.id} project={t} compact />
                    ))}
                    {overflow > 0 && (
                      <p className="px-1 text-xs text-muted-foreground">+{overflow}건</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === "month" && (
        <section className="space-y-2 rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
          <h3 className="text-sm font-bold">
            {selectedKey.replace(/^(\d+)-(\d+)-(\d+)$/, "$2월 $3일")} ({selectedProjects.length}건)
          </h3>
          {selectedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">이 날 마감인 프로젝트가 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {selectedProjects.map((t) => (
                <ProjectChip key={t.id} project={t} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
