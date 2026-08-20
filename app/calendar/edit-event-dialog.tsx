"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCalendarEvent, deleteCalendarEvent } from "@/app/actions/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showToast } from "@/components/ui/global-toast";

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type EditableEvent = {
  id: string;
  calendarId: string;
  calendarSummary: string;
  title: string;
  startDate: Date;
  endDate: Date;
};

// 하단 목록의 일정 태그를 눌러 여는 수정 창. 제목·기간을 고치거나 일정을 지운다.
export function EditEventDialog({
  event,
  onClose,
}: {
  event: EditableEvent | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [errorMessage, formAction, isPending] = useActionState(updateCalendarEvent, undefined);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      showToast("일정이 수정되었습니다");
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  if (!event) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          setConfirmDelete(false);
          setDeleteError(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>일정 수정</DialogTitle>
        </DialogHeader>
        {/* key로 이벤트마다 폼을 새로 마운트해 defaultValue가 이전 일정 값으로 남지 않게 한다. */}
        <form
          key={event.id}
          action={formAction}
          onSubmit={() => {
            submitted.current = true;
          }}
          className="space-y-4"
        >
          <input type="hidden" name="calendarId" value={event.calendarId} />
          <input type="hidden" name="eventId" value={event.id} />
          <p className="text-xs text-muted-foreground">{event.calendarSummary}</p>
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">제목</Label>
            <Input id="edit-title" name="title" defaultValue={event.title} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">시작일</Label>
              <Input
                id="edit-start"
                name="startDate"
                type="date"
                defaultValue={dateKey(event.startDate)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">종료일</Label>
              <Input id="edit-end" name="endDate" type="date" defaultValue={dateKey(event.endDate)} />
            </div>
          </div>
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <div className="flex items-center justify-between gap-2">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">삭제할까요?</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={() =>
                    startDelete(async () => {
                      try {
                        await deleteCalendarEvent(event.calendarId, event.id);
                        showToast("일정이 삭제되었습니다");
                        router.refresh();
                        onClose();
                      } catch (e) {
                        setDeleteError(e instanceof Error ? e.message : "삭제할 수 없습니다.");
                        setConfirmDelete(false);
                      }
                    })
                  }
                >
                  네, 삭제
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                  아니요
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                삭제
              </Button>
            )}
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
