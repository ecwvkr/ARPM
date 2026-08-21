"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, isOverdue, type ParticipantChipData } from "@/lib/priority";
import { ProjectCard } from "@/app/partners/[partnerId]/project-card";
import { NewProjectDialog } from "@/app/partners/[partnerId]/new-project-dialog";
import { AddEventDialog } from "./add-event-dialog";
import { EditEventDialog } from "./edit-event-dialog";
import { moveCalendarEvent } from "@/app/actions/google";
import { IconBrandGoogle, IconArrowRight, IconCheck, IconChevronRight } from "@tabler/icons-react";

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
  startDate: Date | null;
  createdAt: Date;
  partnerName: string;
  partnerColor: string | null;
  participants: ParticipantChipData[];
  commentCount: number;
  links: string[];
  unread: boolean;
  pinned: boolean;
};

const PRIORITY_RANK: Record<string, number> = { URGENT: 3, NORMAL: 2, HOLD: 1 };

// 하단 목록 정렬: 개인 고정을 맨 위로, 완료는 항상 맨 아래로 내리고, 그 안에서
// 마감일 임박순 → 내 우선순위(긴급>보통>보류) → 가나다순.
function sortCalendarProjects(projects: CalendarProject[], currentUserId: string): CalendarProject[] {
  return [...projects].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    const aDone = a.status === "DONE";
    const bDone = b.status === "DONE";
    if (aDone !== bDone) return aDone ? 1 : -1;

    const aDue = a.dueDate ? a.dueDate.getTime() : Infinity;
    const bDue = b.dueDate ? b.dueDate.getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;

    const aLevel = a.participants.find((p) => p.userId === currentUserId)?.level ?? "HOLD";
    const bLevel = b.participants.find((p) => p.userId === currentUserId)?.level ?? "HOLD";
    if (aLevel !== bLevel) return PRIORITY_RANK[bLevel] - PRIORITY_RANK[aLevel];

    return a.title.localeCompare(b.title, "ko");
  });
}

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
  startAt: Date | null;
  endAt: Date | null;
  convertedProjectId: string | null;
  convertedPartnerId: string | null;
};

// 시간 지정 일정의 시각 표기. 하루 안에서 끝나면 "14:00~15:00", 여러 날에 걸치면
// 시작 시각만 보여준다(칩이 좁아 둘 다 넣으면 제목이 밀린다).
function eventTimeLabel(event: CalendarGoogleEvent): string | null {
  if (!event.startAt) return null;
  const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay = !!event.endAt && dateKey(event.startAt) === dateKey(event.endAt);
  return sameDay && event.endAt ? `${hm(event.startAt)}~${hm(event.endAt)}` : hm(event.startAt);
}

// 서버 액션에 그대로 되돌려줄 "HH:MM". 드래그 이동에서 시각을 유지하는 데 쓴다.
function hhmm(d: Date | null): string | null {
  return d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : null;
}

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

function dateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// 여러 날에 걸친 구글 일정을 주(week) 단위로 잘라 시작~끝 칸(0~6, 일~토)을 구한다.
// 주 경계에서 잘린 세그먼트는 실제 시작/끝이 아니므로 그쪽 모서리를 각지게 둬서
// "다음 주로 이어짐"을 표시한다.
type WeekItem =
  | { kind: "project"; key: string; startCol: number; endCol: number; data: CalendarProject }
  | {
      kind: "google";
      key: string;
      startCol: number;
      endCol: number;
      data: CalendarGoogleEvent;
      isActualStart: boolean;
      isActualEnd: boolean;
    };

const MAX_LANES = 2; // 기존 칸당 2건 표시 예산과 동일하게 맞춘다.
const NUMBER_ROW_H = 24;
// 레인 높이에 상하 1px씩(py-px) 여백을 더해, 바가 세로로 붙어도 서로 구분된다(캘린더 2).
const LANE_H = 22;

// 월간뷰 바에 마우스를 올리면 그 자리에 바로 상세를 띄운다(캘린더 1).
type HoverInfo = { x: number; y: number; lines: string[] } | null;

function layoutWeek(weekDays: Date[], projects: CalendarProject[], googleEvents: CalendarGoogleEvent[]) {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const items: WeekItem[] = [];

  for (const p of projects) {
    if (!p.dueDate) continue;
    const d = dateOnly(new Date(p.dueDate));
    if (d < weekStart || d > weekEnd) continue;
    const col = Math.round((d.getTime() - weekStart.getTime()) / 86_400_000);
    items.push({ kind: "project", key: p.id, startCol: col, endCol: col, data: p });
  }

  for (const e of googleEvents) {
    if (e.endDate < weekStart || e.startDate > weekEnd) continue;
    const clampedStart = e.startDate < weekStart ? weekStart : e.startDate;
    const clampedEnd = e.endDate > weekEnd ? weekEnd : e.endDate;
    items.push({
      kind: "google",
      key: `${e.calendarId}-${e.id}`,
      startCol: Math.round((clampedStart.getTime() - weekStart.getTime()) / 86_400_000),
      endCol: Math.round((clampedEnd.getTime() - weekStart.getTime()) / 86_400_000),
      data: e,
      isActualStart: clampedStart.getTime() === e.startDate.getTime(),
      isActualEnd: clampedEnd.getTime() === e.endDate.getTime(),
    });
  }

  // 겹치는 항목은 레인을 나눠 배치한다(구간 그래프 색칠의 그리디 버전) — 레인 수를
  // 넘어가면 그 항목이 걸치는 모든 날짜의 "+N건" 카운트에 더한다.
  items.sort((a, b) => a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol));
  const laneEnds: number[] = [];
  const placed: { item: WeekItem; lane: number }[] = [];
  const overflowCols = new Array(7).fill(0);

  for (const item of items) {
    let lane = laneEnds.findIndex((end) => end < item.startCol);
    if (lane === -1) lane = laneEnds.length;
    if (lane >= MAX_LANES) {
      for (let c = item.startCol; c <= item.endCol; c++) overflowCols[c]++;
      continue;
    }
    laneEnds[lane] = item.endCol;
    placed.push({ item, lane });
  }

  return { placed, overflowCols };
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
// 배경을 쓴다. 캘린더별 색상은 왼쪽 테두리로만 얹는다. 전환 버튼은 칸이 좁은 월간뷰
// 바에는 안 두고(WeekBarItem), 여유 있는 일간뷰·선택 패널에서만 보여준다(G5).
function GoogleEventChip({
  event,
  compact = false,
  partners,
  currentUserId,
  onEdit,
}: {
  event: CalendarGoogleEvent;
  compact?: boolean;
  partners?: { id: string; name: string }[];
  currentUserId?: string;
  onEdit?: (event: CalendarGoogleEvent) => void;
}) {
  const timeLabel = eventTimeLabel(event);

  return (
    <div
      style={{ borderLeftColor: event.calendarColor }}
      className="flex items-center gap-1.5 rounded-md border-l-2 bg-muted py-0.5 pr-1 pl-1.5 text-xs text-muted-foreground"
      title={`${timeLabel ? `${timeLabel} ` : ""}${event.title} · ${event.calendarSummary}`}
    >
      <IconBrandGoogle className="size-3 shrink-0" />
      {/* 시간 지정 일정은 시각을 제목 앞에 붙인다. 종일 일정은 아무것도 붙지 않는다. */}
      {timeLabel && <span className="shrink-0 font-medium tabular-nums">{timeLabel}</span>}
      {/* 태그 본문을 눌러 제목·기간 수정과 삭제 창을 연다. */}
      {onEdit ? (
        <button
          type="button"
          onClick={() => onEdit(event)}
          className="min-w-0 flex-1 truncate text-left hover:text-foreground hover:underline"
        >
          {compact ? event.title : `${event.title} · ${event.calendarSummary}`}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate">
          {compact ? event.title : `${event.title} · ${event.calendarSummary}`}
        </span>
      )}
      {event.convertedProjectId && event.convertedPartnerId ? (
        <Link
          href={`/partners/${event.convertedPartnerId}?project=${event.convertedProjectId}`}
          className="shrink-0 whitespace-nowrap text-primary underline underline-offset-2"
        >
          전환됨
        </Link>
      ) : (
        partners &&
        currentUserId && (
          <NewProjectDialog
            partners={partners}
            currentUserId={currentUserId}
            initial={{
              title: event.title,
              dueDate: dateKey(event.endDate),
              startDate: event.startDate.getTime() !== event.endDate.getTime() ? dateKey(event.startDate) : undefined,
              sourceGoogleEventId: event.id,
            }}
            trigger={
              <button
                type="button"
                className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-primary underline underline-offset-2"
              >
                업무로 전환
                <IconArrowRight className="size-3" />
              </button>
            }
          />
        )
      )}
    </div>
  );
}

// 호버 시 보여줄 상세 줄. title 속성은 뜨기까지 1초 넘게 걸려 "바로 뜨는" 요구를 못 맞춘다.
function hoverLinesFor(item: WeekItem): string[] {
  if (item.kind === "project") {
    const p = item.data;
    return [
      p.title,
      `파트너: ${p.partnerName}`,
      `상태: ${STATUS_LABEL[p.status]}`,
      p.dueDate ? `마감: ${new Date(p.dueDate).toLocaleDateString("ko-KR")}` : "마감일 없음",
    ];
  }
  const e = item.data;
  const sameDay = e.startDate.getTime() === e.endDate.getTime();
  return [
    e.title,
    `캘린더: ${e.calendarSummary}`,
    sameDay
      ? e.startDate.toLocaleDateString("ko-KR")
      : `${e.startDate.toLocaleDateString("ko-KR")} ~ ${e.endDate.toLocaleDateString("ko-KR")}`,
    ...(e.convertedProjectId ? ["업무로 전환됨"] : []),
  ];
}

// 주 그리드 안에서 여러 칸에 걸쳐 놓이는 바. 프로젝트는 항상 하루짜리라 기존
// ProjectChip을 그대로 쓰고, 구글 일정만 실제 시작/끝 여부에 따라 모서리를 다르게 둔다.
function WeekBarItem({ item }: { item: WeekItem }) {
  if (item.kind === "project") return <ProjectChip project={item.data} compact />;

  const e = item.data;
  const converted = !!e.convertedProjectId;
  // 월간뷰 바는 칸이 좁으므로 시작 시각만 붙인다.
  const barTime = e.startAt ? eventTimeLabel(e)?.split("~")[0] : null;
  return (
    <div
      style={{
        backgroundColor: `color-mix(in oklch, ${e.calendarColor} 22%, var(--muted))`,
        borderLeftColor: e.calendarColor,
      }}
      className={`flex h-full items-center gap-1 overflow-hidden px-1.5 text-xs text-foreground ${
        item.isActualStart ? "rounded-l-md border-l-4" : ""
      } ${item.isActualEnd ? "rounded-r-md" : ""} ${converted ? "opacity-60" : ""}`}
      title={converted ? `${e.title} · ${e.calendarSummary} (업무로 전환됨)` : `${e.title} · ${e.calendarSummary}`}
    >
      {item.isActualStart && (converted ? <IconCheck className="size-3 shrink-0" /> : <IconBrandGoogle className="size-3 shrink-0" />)}
      {item.isActualStart && barTime && <span className="shrink-0 tabular-nums">{barTime}</span>}
      <span className="truncate">{e.title}</span>
    </div>
  );
}

// 요청 6: 하단 목록을 프로젝트/캘린더 일정으로 나눠 각각 아코디언으로 접고 펼친다.
function AccordionSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <details className="group" open>
      <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-bold">
        {title} ({count})
        <IconChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-2 space-y-1">{children}</div>
    </details>
  );
}

export function CalendarView({
  initialDate,
  initialView,
  projects,
  googleEvents,
  currentUserId,
  partners,
}: {
  initialDate: string;
  initialView: CalendarView;
  projects: CalendarProject[];
  googleEvents: CalendarGoogleEvent[];
  currentUserId: string;
  partners: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>(initialView);
  const [cursor, setCursor] = useState(() => new Date(`${initialDate}T00:00:00`));
  const [selectedKey, setSelectedKey] = useState(initialDate);
  const [hover, setHover] = useState<HoverInfo>(null);
  const [editing, setEditing] = useState<CalendarGoogleEvent | null>(null);
  // 드래그 중인 구글 일정. grabbedKey는 '바에서 잡은 날짜'로, 놓은 날과의 차이만큼 이동시킨다
  // (여러 날짜에 걸친 일정을 가운데서 잡아도 그 자리를 유지한 채 움직이게 하려는 것).
  const [dragging, setDragging] = useState<{ event: CalendarGoogleEvent; grabbedKey: string } | null>(null);
  const [isMoving, startMove] = useTransition();

  const cursorKey = dateKey(cursor);

  useEffect(() => {
    router.replace(`/calendar?v=${view}&d=${cursorKey}`, { scroll: false });
  }, [view, cursorKey, router]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (key: string, item: DayItem) => map.set(key, [...(map.get(key) ?? []), item]);

    // 요청 5: 마감일 하루만이 아니라 시작일(없으면 생성일)부터 마감일까지 진행 기간
    // 전체에 걸쳐 하단 목록에 노출한다 — 구글 일정의 기간 표시와 같은 방식.
    for (const t of projects) {
      if (!t.dueDate) continue;
      const start = dateOnly(new Date(t.startDate ?? t.createdAt));
      const end = dateOnly(new Date(t.dueDate));
      const rangeStart = start > end ? end : start;
      for (let d = rangeStart; d <= end; d = addDays(d, 1)) {
        push(dateKey(d), { kind: "project", data: t });
      }
    }
    for (const e of googleEvents) {
      // 일간뷰·선택 패널은 걸치는 날마다 항목을 하나씩 둔다(단순 목록이라 레인이 필요 없다).
      // 월간뷰의 이어지는 바는 이 맵을 안 쓰고 layoutWeek()가 주 단위로 따로 계산한다.
      for (let d = new Date(e.startDate); d <= e.endDate; d = addDays(d, 1)) {
        push(dateKey(d), { kind: "google", data: e });
      }
    }
    // 하루 안에서는 종일 일정을 먼저, 시간 지정 일정을 시각순으로 둔다 — 구글 캘린더와 같은 순서.
    for (const items of map.values()) {
      items.sort((a, b) => {
        if (a.kind !== "google" || b.kind !== "google") return 0;
        const at = a.data.startAt?.getTime() ?? -1;
        const bt = b.data.startAt?.getTime() ?? -1;
        return at - bt;
      });
    }
    return map;
  }, [projects, googleEvents]);

  const todayKey = dateKey(new Date());
  // ponytail: 42개 Date 생성과 6칸 청크는 memo할 가치가 없다.
  const monthDays = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const weeks: Date[][] = [];
  for (let i = 0; i < monthDays.length; i += 7) weeks.push(monthDays.slice(i, i + 7));
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

  // 잡은 날짜와 놓은 날짜의 차이만큼 일정 전체를 밀어서 기간 길이는 그대로 유지한다.
  function handleEventDrop(dropKey: string) {
    const drag = dragging;
    setDragging(null);
    if (!drag || drag.grabbedKey === dropKey) return;

    const deltaDays = Math.round(
      (new Date(`${dropKey}T00:00:00`).getTime() - new Date(`${drag.grabbedKey}T00:00:00`).getTime()) / 86_400_000,
    );
    if (deltaDays === 0) return;

    const nextStart = addDays(drag.event.startDate, deltaDays);
    const nextEnd = addDays(drag.event.endDate, deltaDays);

    startMove(async () => {
      try {
        await moveCalendarEvent(
          drag.event.calendarId,
          drag.event.id,
          dateKey(nextStart),
          dateKey(nextEnd),
          hhmm(drag.event.startAt),
          hhmm(drag.event.endAt),
        );
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "일정을 옮길 수 없습니다.");
      }
    });
  }

  const title =
    view === "day"
      ? `${cursor.getMonth() + 1}월 ${cursor.getDate()}일 (${WEEKDAY[cursor.getDay()]})`
      : `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;

  const dayItems = itemsByDate.get(cursorKey) ?? [];
  const dayProjects = sortCalendarProjects(
    dayItems.filter((i) => i.kind === "project").map((i) => i.data),
    currentUserId,
  );
  const dayGoogleEvents = dayItems.filter((i) => i.kind === "google").map((i) => i.data);
  const selectedItemsAll = itemsByDate.get(selectedKey) ?? [];
  const selectedProjects = sortCalendarProjects(
    selectedItemsAll.filter((i) => i.kind === "project").map((i) => i.data),
    currentUserId,
  );
  const selectedGoogleEvents = selectedItemsAll.filter((i) => i.kind === "google").map((i) => i.data);

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
        <AddEventDialog defaultDate={view === "day" ? cursorKey : selectedKey} />
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

          {/* 캘린더 일정 → 진행 중인 프로젝트 순서(캘린더 3). */}
          <AccordionSection title="캘린더 일정" count={dayGoogleEvents.length}>
            {dayGoogleEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">이 날 구글 일정이 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {dayGoogleEvents.map((e) => (
                  <GoogleEventChip
                    key={`${e.calendarId}-${e.id}`}
                    event={e}
                    partners={partners}
                    currentUserId={currentUserId}
                    onEdit={setEditing}
                  />
                ))}
              </div>
            )}
          </AccordionSection>

          <AccordionSection title="진행 중인 프로젝트" count={dayProjects.length}>
            {dayProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">이 날 진행 중인 프로젝트가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
                {dayProjects.map((t) => (
                  <ProjectCard
                    key={t.id}
                    projectId={t.id}
                    partnerId={t.partnerId}
                    title={t.title}
                    status={t.status}
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
                    pinned={t.pinned}
                  />
                ))}
              </div>
            )}
          </AccordionSection>
        </>
      ) : (
        <div className="overflow-hidden rounded-4xl bg-card p-3 shadow-md ring-1 ring-foreground/5 sm:p-4 dark:ring-foreground/10">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs text-muted-foreground">
            {WEEKDAY.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="space-y-1">
            {weeks.map((weekDays) => {
              const { placed, overflowCols } = layoutWeek(weekDays, projects, googleEvents);
              const weekHeight = NUMBER_ROW_H + MAX_LANES * LANE_H + 16;
              return (
                <div
                  key={dateKey(weekDays[0])}
                  className="relative"
                  style={{ height: weekHeight }}
                  // 드롭은 이 주 전체에서 받는다 — 칸마다 핸들러를 달면 위에 얹힌 바가
                  // 히트 테스트를 가로채므로, 놓은 x좌표로 요일 칸을 직접 계산한다.
                  onDragOver={(e) => {
                    if (dragging) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (!dragging) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const col = Math.min(6, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * 7)));
                    handleEventDrop(dateKey(weekDays[col]));
                  }}
                >
                  {/* 배경: 요일별 클릭 선택 영역 + 오늘/이번달 아님/선택 표시. 클릭은 이 레이어가
                      받고, 앞 레이어(숫자·바)는 프로젝트 칩 등 실제 인터랙션이 필요한 부분만
                      pointer-events-auto로 다시 열어준다. */}
                  <div className="absolute inset-0 grid grid-cols-7 gap-1">
                    {weekDays.map((d) => {
                      const key = dateKey(d);
                      const inMonth = d.getMonth() === cursor.getMonth();
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedKey(key)}
                          aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일 선택`}
                          className={`rounded-xl ${inMonth ? "" : "opacity-40"} ${
                            key === selectedKey ? "ring-2 ring-primary" : ""
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div
                    className="pointer-events-none absolute inset-0 grid grid-cols-7 gap-x-1 p-1"
                    style={{ gridTemplateRows: `${NUMBER_ROW_H}px repeat(${MAX_LANES}, ${LANE_H}px) auto` }}
                  >
                    {weekDays.map((d, col) => {
                      const key = dateKey(d);
                      return (
                        <span
                          key={key}
                          style={{ gridColumn: col + 1, gridRow: 1 }}
                          className={`inline-flex size-6 items-center justify-center justify-self-start rounded-full text-xs ${
                            key === todayKey ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {d.getDate()}
                        </span>
                      );
                    })}
                    {placed.map(({ item, lane }) => (
                      <div
                        key={item.key}
                        style={{ gridColumn: `${item.startCol + 1} / ${item.endCol + 2}`, gridRow: lane + 2 }}
                        className={`pointer-events-auto min-w-0 py-px ${
                          item.kind === "google" ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                        // 구글 일정만 옮길 수 있다 — 프로젝트 칩의 날짜는 프로젝트 마감일이라
                        // 여기서 끌어 바꾸면 업무 데이터가 조용히 바뀐다.
                        draggable={item.kind === "google"}
                        onDragStart={(e) => {
                          if (item.kind !== "google") return;
                          setHover(null);
                          e.dataTransfer.effectAllowed = "move";
                          // 바 안에서 잡은 지점이 어느 날짜인지 계산해 그 상대 위치를 유지한다.
                          const rect = e.currentTarget.getBoundingClientRect();
                          const cols = item.endCol - item.startCol + 1;
                          const offset = Math.min(
                            cols - 1,
                            Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * cols)),
                          );
                          setDragging({
                            event: item.data,
                            grabbedKey: dateKey(weekDays[item.startCol + offset]),
                          });
                        }}
                        onDragEnd={() => setDragging(null)}
                        onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, lines: hoverLinesFor(item) })}
                        onMouseMove={(e) => setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))}
                        onMouseLeave={() => setHover(null)}
                      >
                        <WeekBarItem item={item} />
                      </div>
                    ))}
                    {weekDays.map((d, col) =>
                      overflowCols[col] > 0 ? (
                        <p
                          key={dateKey(d)}
                          style={{ gridColumn: col + 1, gridRow: MAX_LANES + 2 }}
                          className="px-1 text-xs text-muted-foreground"
                        >
                          +{overflowCols[col]}건
                        </p>
                      ) : null,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "month" && (
        <section className="space-y-3 rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
          <h3 className="text-sm font-bold text-muted-foreground">
            {selectedKey.replace(/^(\d+)-(\d+)-(\d+)$/, "$2월 $3일")}
          </h3>

          {/* 캘린더 일정 → 진행 중인 프로젝트 순서(캘린더 3). */}
          <AccordionSection title="캘린더 일정" count={selectedGoogleEvents.length}>
            {selectedGoogleEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">이 날 구글 일정이 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {selectedGoogleEvents.map((e) => (
                  <GoogleEventChip
                    key={`${e.calendarId}-${e.id}`}
                    event={e}
                    partners={partners}
                    currentUserId={currentUserId}
                    onEdit={setEditing}
                  />
                ))}
              </div>
            )}
          </AccordionSection>

          {/* 일간 뷰와 같은 카드 형태로 통일한다(캘린더 4). */}
          <AccordionSection title="진행 중인 프로젝트" count={selectedProjects.length}>
            {selectedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">이 날 진행 중인 프로젝트가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
                {selectedProjects.map((t) => (
                  <ProjectCard
                    key={t.id}
                    projectId={t.id}
                    partnerId={t.partnerId}
                    title={t.title}
                    status={t.status}
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
                    pinned={t.pinned}
                  />
                ))}
              </div>
            )}
          </AccordionSection>
        </section>
      )}

      <EditEventDialog event={editing} onClose={() => setEditing(null)} />

      {isMoving && (
        <div className="fixed bottom-6 left-1/2 z-100 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs text-background shadow-lg">
          일정을 옮기는 중...
        </div>
      )}

      {hover && !dragging && (
        <div
          className="pointer-events-none fixed z-100 max-w-64 rounded-xl bg-foreground px-3 py-2 text-xs text-background shadow-lg"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          {hover.lines.map((line, i) => (
            <p key={i} className={i === 0 ? "font-medium" : "opacity-80"}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
