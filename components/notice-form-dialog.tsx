"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createNotice, updateNotice, deleteNotice } from "@/app/actions/notices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showToast } from "@/components/ui/global-toast";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";

// 공지 작성·수정 창. notice가 없으면 새로 쓰는 것이고, 있으면 그 공지를 고치는 것이다.
// 목록은 서버 컴포넌트가 그리므로 저장 후 화면 갱신은 액션 쪽 revalidatePath가 맡는다.
export function NoticeFormDialog({
  partnerId,
  notice,
}: {
  partnerId?: string;
  notice?: { id: string; title: string; body: string };
}) {
  const [open, setOpen] = useState(false);
  const action = notice ? updateNotice.bind(null, notice.id) : createNotice;
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
      showToast(notice ? "공지를 수정했습니다" : "공지를 등록했습니다");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <>
      {notice ? (
        <Button
          size="icon-xs"
          variant="ghost"
          title="공지 수정"
          aria-label="공지 수정"
          onClick={() => setOpen(true)}
        >
          <IconPencil />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <IconPlus className="size-3.5" />
          공지 등록
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{notice ? "공지 수정" : "공지 등록"}</DialogTitle>
          </DialogHeader>
          <form
            action={formAction}
            onSubmit={() => {
              submitted.current = true;
            }}
            className="space-y-4"
          >
            {/* 새 공지는 어디에 쓸지 폼으로 알려준다. 수정은 저장된 소속을 그대로 쓰므로 안 보낸다. */}
            {!notice && partnerId && <input type="hidden" name="partnerId" value={partnerId} />}
            <div className="space-y-1.5">
              <Label htmlFor="notice-title">제목</Label>
              <Input id="notice-title" name="title" defaultValue={notice?.title} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice-body">내용</Label>
              <Textarea id="notice-body" name="body" defaultValue={notice?.body} rows={6} required />
            </div>
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "저장 중..." : "저장하기"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// 삭제는 되돌릴 수 없으므로 한 번 더 누르게 한다 — 별도 팝업까지는 두지 않는다.
export function NoticeDeleteButton({ noticeId }: { noticeId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                await deleteNotice(noticeId);
                showToast("공지를 삭제했습니다");
              } catch {
                alert("삭제할 수 없습니다. 권한을 확인하세요.");
              }
            })
          }
        >
          삭제
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          취소
        </Button>
      </span>
    );
  }

  return (
    <Button
      size="icon-xs"
      variant="ghost"
      title="공지 삭제"
      aria-label="공지 삭제"
      onClick={() => setConfirming(true)}
    >
      <IconTrash />
    </Button>
  );
}
