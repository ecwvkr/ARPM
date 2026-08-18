"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, isOverdue, type ParticipantChipData } from "@/lib/priority";
import { ProjectCard } from "@/app/partners/[partnerId]/project-card";
import { IconBrandGoogle } from "@tabler/icons-react";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
// 주간 뷰는 월간 뷰와 보여주는 게 겹쳐 없앴다.
const VIEWS = [
  { key: "day", label: "일간 뷰" },
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

// lib/google/calendar.ts의 NormalizedGoogleEvent와 같은 모양 — 서버 컴포넌트에서
// Date 필드를 그대로 넘겨받는다(CalendarProject도 같은 방식).
export type CalendarGoogleEvent = {
  id: string;
  calendarId: string;
  calendarSummary: string;
  calendarColor: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
};

// 월간뷰 칸·선택 패널은 프로젝트 마감일 칩과 구글 일정 칩을 같은 목록에 섞어서
// 보여준다 — 2건 초과 시 접는 로직과 렌더링을 한 곳에서 함께 처리하기 위한 태그.
type DayItem = { kind: "project"; data: CalendarProject } | { kind: "google"; data: CalendarGoogleEvent };

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

// 프로젝트 칩(secondary/destructive 배경)과 한눈에 구분되도록 구글 아이콘 + 중립
// 배경을 쓴다. 캘린더별 색상은 왼쪽 테두리로만 얹는다(전환 기능은 G5에서 붙는다).
function GoogleEventChip({ event, compact = false }: { event: CalendarGoogleEvent; compact?: boolean }) {
  return (
    <div
      style={{ borderLeftColor: event.calendarColor }}
      className="flex items-center gap-1 truncate rounded-md border-l-2 bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
      title={`${event.title} · ${event.calendarSummary}`}
    >
      <IconBrandGoogle className="size-3 shrink-0" />
      <span className="truncate">{compact ? event.title : `${event.title} · ${event.calendarSummary}`}</span>
    </div>
  );
}

function DayItemChip({ item, compact = false }: { item: DayItem; compact?: boolean }) {
  return item.kind === "project" ? (
    <ProjectChip project={item.data} compact={compact} />
  ) : (
    <GoogleEventChip event={item.data} compact={compact} />
  );
}

export function CalendarView({
  initialDate,
  initialView,
  projects,
  googleEvents,
  currentUserId,
}: {
  initialDate: string;
  initialView: CalendarView;
  projects: CalendarProject[];
  googleEvents: CalendarGoogleEvent[];
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

  const itemsByDate = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (key: string, item: DayItem) => map.set(key, [...(map.get(key) ?? []), item]);

    for (const t of projects) {
      if (!t.dueDate) continue;
      push(dateKey(new Date(t.dueDate)), { kind: "project", data: t });
    }
    for (const e of googleEvents) {
      // 여러 날에 걸친 일정은 걸치는 날마다 칩을 하나씩 둔다 — 이어지는 바 표시는
      // 별도 단계(G3)에서 붙이고, 지금은 날짜별 목록에 데이터가 맞게 들어가는 것까지만 맞춘다.
      for (let d = new Date(e.startDate); d <= e.endDate; d = addDays(d, 1)) {
        push(dateKey(d), { kind: "google", data: e });
      }
    }
    return map;
  }, [projects, googleEvents]);

  const todayKey = dateKey(new Date());
  // ponytail: 42개 Date 생성은 memo할 가치가 없다.
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
      : selectedKey === todayKey &&
        cursor.getFullYear() === today.getFullYear() &&
        cursor.getMonth() === today.getMonth();

  function go(delta: number) {
    if (view === "day") setCursor(addDays(cursor, delta));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  const title =
    view === "day"
      ? `${cursor.getMonth() + 1}월 ${cursor.getDate()}일 (${WEEKDAY[cursor.getDay()]})`
      : `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;

  const dayItems = itemsByDate.get(cursorKey) ?? [];
  const dayProjects = dayItems.filter((i) => i.kind === "project").map((i) => i.data);
  const dayGoogleEvents = dayItems.filter((i) => i.kind === "google").map((i) => i.data);
  const selectedItems = itemsByDate.get(selectedKey) ?? [];

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
          aria-label={view === "day" ? "이전날" : "이전달"}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ←
        </button>
        <h2 className="text-sm font-medium">{title}</h2>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label={view === "day" ? "다음날" : "다음달"}
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
              const count = (itemsByDate.get(key) ?? []).length;
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

          {dayGoogleEvents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold">구글 일정</h3>
              <div className="space-y-1">
                {dayGoogleEvents.map((e) => (
                  <GoogleEventChip key={`${e.calendarId}-${e.id}`} event={e} />
                ))}
              </div>
            </div>
          )}
        </>
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
              const cellItems = itemsByDate.get(key) ?? [];
              // 칸 높이를 고정하고 2건까지만 보여준 뒤 나머지는 개수로 접는다.
              // 전체는 아래 선택 패널에서 확인한다(칸이 늘어나 그리드가 흔들리지 않게).
              const visible = cellItems.slice(0, 2);
              const overflow = cellItems.length - visible.length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`flex h-24 flex-col items-start overflow-hidden rounded-xl p-1 text-left ${inMonth ? "" : "opacity-40"} ${
                    key === selectedKey ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <span
                    className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      key === todayKey
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-1 w-full space-y-0.5">
                    {visible.map((item) => (
                      <DayItemChip key={item.kind === "project" ? item.data.id : `${item.data.calendarId}-${item.data.id}`} item={item} compact />
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
            {selectedKey.replace(/^(\d+)-(\d+)-(\d+)$/, "$2월 $3일")} ({selectedItems.length}건)
          </h3>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">이 날 마감인 프로젝트가 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {selectedItems.map((item) => (
                <DayItemChip key={item.kind === "project" ? item.data.id : `${item.data.calendarId}-${item.data.id}`} item={item} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
