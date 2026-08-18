"use client";

import { useState, useTransition } from "react";
import { disconnectGoogleAccount, updateEnabledCalendarSelection } from "@/app/actions/google";
import type { GoogleCalendarListItem } from "@/lib/google/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IconBrandGoogle } from "@tabler/icons-react";

type Status = { googleEmail: string; connectedAt: Date; connectedByName: string } | null;

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR");
}

export function GoogleConnectionPanel({ status }: { status: Status }) {
  if (!status) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          연결하면 이 캘린더의 일정이 웹앱 캘린더 뷰에 함께 표시되고, 웹앱에서 등록한 업무는
          &quot;AR_PM 업무&quot;라는 별도 캘린더로 구글에 자동 생성되어 내보내집니다.
        </p>
        <Button
          render={
            <a href="/api/google/connect">
              <IconBrandGoogle className="size-4" />
              구글 캘린더 연결
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 p-3 text-sm">
        <Badge variant="secondary">연결됨</Badge>
        <span className="font-medium text-foreground">{status.googleEmail}</span>
        <span className="text-xs text-muted-foreground">
          {formatDate(status.connectedAt)} · {status.connectedByName}님이 연결
        </span>
      </div>
      <DisconnectConfirmDialog email={status.googleEmail} />
    </div>
  );
}

type CalendarsResult =
  | { calendars: GoogleCalendarListItem[]; enabledCalendarIds: string[] }
  | { error: "not_connected" | "reconnect_needed" };

const CALENDAR_ERROR_LABEL: Record<string, string> = {
  not_connected: "연결된 계정이 없습니다.",
  reconnect_needed: "구글 연결이 만료되었습니다. 위에서 연결을 해제하고 다시 연결해 주세요.",
};

export function GoogleCalendarSelector({ result }: { result: CalendarsResult }) {
  if ("error" in result) {
    return <p className="text-sm text-destructive">{CALENDAR_ERROR_LABEL[result.error]}</p>;
  }
  if (result.calendars.length === 0) {
    return <p className="text-sm text-muted-foreground">이 계정에서 볼 수 있는 다른 캘린더가 없습니다.</p>;
  }
  return <CalendarCheckboxList calendars={result.calendars} initialEnabledIds={result.enabledCalendarIds} />;
}

function CalendarCheckboxList({
  calendars,
  initialEnabledIds,
}: {
  calendars: GoogleCalendarListItem[];
  initialEnabledIds: string[];
}) {
  const [enabled, setEnabled] = useState(new Set(initialEnabledIds));
  const [isPending, startTransition] = useTransition();

  function toggle(calendarId: string, checked: boolean) {
    const next = new Set(enabled);
    if (checked) next.add(calendarId);
    else next.delete(calendarId);
    setEnabled(next);
    startTransition(async () => {
      await updateEnabledCalendarSelection([...next]);
    });
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-foreground">캘린더 뷰에 표시할 캘린더</h4>
      <p className="text-xs text-muted-foreground">
        체크한 캘린더의 일정만 웹앱 캘린더 뷰에 함께 표시됩니다. 소유한 캘린더뿐 아니라 공유받거나
        구독한 캘린더도 고를 수 있습니다.
      </p>
      <ul className="space-y-1">
        {calendars.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-2xl bg-muted/50 p-2.5 text-sm">
            <input
              type="checkbox"
              id={`gcal-${c.id}`}
              checked={enabled.has(c.id)}
              disabled={isPending}
              onChange={(e) => toggle(c.id, e.target.checked)}
              className="size-4"
            />
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.backgroundColor }} />
            <label htmlFor={`gcal-${c.id}`} className="min-w-0 flex-1 truncate">
              {c.summary}
            </label>
            {c.accessRole === "reader" && (
              <span className="shrink-0 text-xs text-muted-foreground">공유받음</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DisconnectConfirmDialog({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="destructive">연결 해제</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>구글 캘린더 연결 해제</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {email} 연결을 해제합니다. 캘린더 뷰에서 구글 일정이 더 이상 보이지 않고, 웹앱 업무 내보내기도
          멈춥니다. 계속하시겠습니까?
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            아니요
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await disconnectGoogleAccount();
                setOpen(false);
              })
            }
          >
            연결 해제
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
