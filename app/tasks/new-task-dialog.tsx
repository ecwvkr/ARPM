"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTaskFromPicker } from "@/app/actions/tasks";
import { listProjectOptionsForPartner } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateButton } from "@/components/create-button";

const SELECT_CLASS =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs";

// 태스크 탭에서 바로 태스크를 만든다. 태스크는 프로젝트에 매달리는 것이라 파트너 →
// 프로젝트를 먼저 고르게 한다. 프로젝트 목록은 파트너를 고른 뒤에 받아 온다 —
// 전체를 미리 실어 보내면 파트너가 늘수록 페이지가 무거워진다.
export function NewTaskDialog({ partners }: { partners: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [errorMessage, formAction, isPending] = useActionState(createTaskFromPicker, undefined);
  const submitted = useRef(false);

  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  // 어느 파트너 것을 받아 왔는지 함께 들고 있는다. 파트너를 바꿀 때 effect 안에서
  // 목록을 비우면(동기 setState) 렌더가 연쇄로 도는 문제가 생기므로, 대신 담긴
  // 파트너가 지금 고른 것과 다르면 "아직 못 받았다"로 본다.
  const [loaded, setLoaded] = useState<{ partnerId: string; list: { id: string; title: string }[] } | null>(null);
  const projects = loaded?.partnerId === partnerId ? loaded.list : null;

  useEffect(() => {
    if (!open || !partnerId) return;
    let cancelled = false;
    listProjectOptionsForPartner(partnerId)
      .then((list) => {
        if (!cancelled) setLoaded({ partnerId, list });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ partnerId, list: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, partnerId]);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
    }
  }, [isPending, errorMessage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<CreateButton label="태스크 추가" />} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>태스크 추가</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => {
            submitted.current = true;
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="task-partner">파트너</Label>
            <select
              id="task-partner"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className={SELECT_CLASS}
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-project">프로젝트</Label>
            {projects === null ? (
              <p className="text-xs text-muted-foreground">불러오는 중...</p>
            ) : projects.length === 0 ? (
              <p className="text-xs text-muted-foreground">이 파트너에 프로젝트가 없습니다.</p>
            ) : (
              <select id="task-project" name="projectId" required className={SELECT_CLASS}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-title">내용</Label>
            <Input id="task-title" name="title" required placeholder="할 일을 적어 주세요" />
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <Button type="submit" disabled={isPending || !projects?.length} className="w-full">
            {isPending ? "추가 중..." : "추가하기"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
