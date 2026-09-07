"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createPartnerLink, updatePartnerLink, deletePartnerLink } from "@/app/actions/partner-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showToast } from "@/components/ui/global-toast";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";

// 링크 카드 추가·수정 창. link가 없으면 새로 만드는 것이고, 있으면 그 카드를 고친다.
// 목록은 서버 컴포넌트가 그리므로 저장 후 화면 갱신은 액션 쪽 revalidatePath가 맡는다.
export function PartnerLinkFormDialog({
  partnerId,
  link,
}: {
  partnerId: string;
  link?: { id: string; title: string; url: string };
}) {
  const [open, setOpen] = useState(false);
  const action = link ? updatePartnerLink.bind(null, link.id) : createPartnerLink.bind(null, partnerId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
      showToast(link ? "링크를 수정했습니다" : "링크를 추가했습니다");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <>
      {link ? (
        <Button
          size="icon-xs"
          variant="ghost"
          title="링크 수정"
          aria-label={`${link.title} 링크 수정`}
          onClick={() => setOpen(true)}
        >
          <IconPencil />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <IconPlus className="size-3.5" />
          링크 추가
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{link ? "링크 수정" : "링크 추가"}</DialogTitle>
          </DialogHeader>
          <form
            action={formAction}
            onSubmit={() => {
              submitted.current = true;
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="link-title">제목</Label>
              <Input id="link-title" name="title" defaultValue={link?.title} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-url">링크</Label>
              {/* type="url"을 쓰면 https:// 없이 적었을 때 브라우저가 먼저 막는다.
                  주소를 스킴 없이 적는 게 보통이라 평범한 칸으로 두고 서버에서 붙여 준다. */}
              <Input id="link-url" name="url" placeholder="https://example.com" defaultValue={link?.url} required />
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
export function PartnerLinkDeleteButton({ linkId, title }: { linkId: string; title: string }) {
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
                await deletePartnerLink(linkId);
                showToast("링크를 삭제했습니다");
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
      title="링크 삭제"
      aria-label={`${title} 링크 삭제`}
      onClick={() => setConfirming(true)}
    >
      <IconTrash />
    </Button>
  );
}
