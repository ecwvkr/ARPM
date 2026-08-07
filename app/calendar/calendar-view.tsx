"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, isOverdue } from "@/lib/priority";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export type CalendarTask = {
  id: string;
  projectId: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: Date | null;
  projectName: string;
  projectColor: string | null;
};

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthGrid(year: number, month: number) {
  const startWeekday = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export function CalendarView({
  initialYear,
  initialMonth,
  tasks,
}: {
  initialYear: number;
  initialMonth: number;
  tasks: CalendarTask[];
}) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => new Date(initialYear, initialMonth, 1));
  const [direction, setDirection] = useState<"left" | "right">("right");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  useEffect(() => {
    router.replace(`/calendar?y=${year}&m=${month + 1}`, { scroll: false });
  }, [year, month, router]);

  function go(delta: number) {
    setDirection(delta > 0 ? "right" : "left");
    setCursor(new Date(year, month + delta, 1));
  }

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const key = dateKey(new Date(t.dueDate));
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [tasks]);

  const days = useMemo(() => monthGrid(year, month), [year, month]);
  const todayKey = dateKey(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="이전달"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ←
        </button>
        <h2 className="text-sm font-medium">
          {year}년 {month + 1}월
        </h2>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="다음달"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          →
        </button>
      </div>

      <div className="overflow-hidden rounded-4xl bg-card shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div
          key={`${year}-${month}`}
          className={`animate-in fade-in p-3 duration-200 sm:p-4 ${
            direction === "right" ? "slide-in-from-right-8" : "slide-in-from-left-8"
          }`}
        >
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs text-muted-foreground">
            {WEEKDAY.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = dateKey(d);
              const inMonth = d.getMonth() === month;
              const dayTasks = tasksByDate.get(key) ?? [];
              const visible = dayTasks.slice(0, 3);
              const overflow = dayTasks.length - visible.length;

              return (
                <div key={key} className={`min-h-[84px] rounded-xl p-1 ${inMonth ? "" : "opacity-40"}`}>
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                      key === todayKey ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {visible.map((t) => (
                      <Link
                        key={t.id}
                        href={`/projects/${t.projectId}?task=${t.id}`}
                        style={t.projectColor ? { borderLeftColor: t.projectColor } : undefined}
                        className={`block truncate rounded-md px-1 py-0.5 text-xs ${
                          t.projectColor ? "border-l-2" : ""
                        } ${
                          isOverdue(t.dueDate, t.status)
                            ? "bg-destructive/15 text-destructive"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                        title={`${t.title} · ${t.projectName} · ${STATUS_LABEL[t.status]}`}
                      >
                        {t.title}
                      </Link>
                    ))}
                    {overflow > 0 && (
                      <p className="px-1 text-xs text-muted-foreground">+{overflow}개 더보기</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
