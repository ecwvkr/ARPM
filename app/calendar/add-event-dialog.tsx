"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addCalendarEvent, listWritableCalendars } from "@/app/actions/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { showToast } from "@/components/ui/global-toast";
import { IconCalendarPlus } from "@tabler/icons-react";

// 캘린더 뷰에서 바로 구글 캘린더에 종일 일정을 추가한다. 대상은 관리자가 '표시할 캘린더'로
// 고른 것들 중에서만 고를 수 있다(그 밖의 캘린더는 뷰에 안 보여 추가해도 확인이 안 된다).
export function AddEventDialog({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof listWritableCalendars>> | null>(null);
  const [errorMessage, formAction, isPending] = useActionState(addCalendarEvent, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (open && !result) listWritableCalendars().then(setResult);
  }, [open, result]);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
      showToast("일정이 추가되었습니다");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <IconCalendarPlus className="size-4" />
            일정 추가
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>일정 추가</DialogTitle>
        </DialogHeader>
        {result === null ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : "error" in result ? (
          <p className="text-sm text-muted-foreground">
            {result.error === "not_connected"
              ? "연결된 구글 계정이 없습니다. 설정 > 구글 연동에서 계정을 먼저 연결하세요."
              : result.error === "no_selection"
                ? "표시할 캘린더가 선택되지 않았습니다. 설정 > 구글 연동에서 캘린더를 먼저 선택하세요."
                : "일정 쓰기 권한이 없습니다. 설정 > 구글 연동에서 계정을 다시 연결해 주세요."}
          </p>
        ) : result.calendars.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            추가할 수 있는 캘린더가 없습니다. 설정 &gt; 구글 연동에서 표시할 캘린더를 먼저 선택하세요.
          </p>
        ) : (
          <form
            action={formAction}
            onSubmit={() => {
              submitted.current = true;
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="event-calendar">캘린더</Label>
              <select
                id="event-calendar"
                name="calendarId"
                defaultValue={result.calendars[0]?.id}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              >
                {result.calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-title">제목</Label>
              <Input id="event-title" name="title" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-start">시작일</Label>
                <Input id="event-start" name="startDate" type="date" defaultValue={defaultDate} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end">종료일</Label>
                <Input id="event-end" name="endDate" type="date" defaultValue={defaultDate} />
              </div>
            </div>
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "추가 중..." : "추가하기"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
