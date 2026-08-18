"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createProject, listProjectOptionsForPartner } from "@/app/actions/projects";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserPicker } from "@/components/user-picker";
import { LinkFields } from "@/components/link-fields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewProjectDialog({
  partnerId,
  partners,
  currentUserId,
  trigger,
  initial,
}: {
  partnerId?: string;
  partners?: { id: string; name: string }[];
  currentUserId: string;
  trigger?: React.ReactElement;
  // 구글 일정을 업무로 전환할 때(G5) 제목·기간을 미리 채워 연다. startDate는 생성 폼에는
  // 노출하지 않고 hidden input으로만 넘긴다 — 일반 생성에는 없는 개념이라서다.
  initial?: { title?: string; dueDate?: string; startDate?: string; sourceGoogleEventId?: string };
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, formAction, isPending] = useActionState(createProject, undefined);
  const submitted = useRef(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState(partnerId ?? partners?.[0]?.id ?? "");
  const [projectOptions, setProjectOptions] = useState<{ id: string; title: string }[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !selectedPartnerId) return;
    listProjectOptionsForPartner(selectedPartnerId).then(setProjectOptions);
  }, [open, selectedPartnerId]);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
      setParticipants([]);
    }
  }, [isPending, errorMessage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="icon-sm" variant="outline" title="새 프로젝트" aria-label="새 프로젝트">
              <IconPlus />
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.sourceGoogleEventId ? "구글 일정을 업무로 전환" : "새 프로젝트"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            participants.forEach((userId) => formData.append("userIds", userId));
            submitted.current = true;
            formAction(formData);
          }}
          className="space-y-4"
        >
          {partnerId ? (
            <input type="hidden" name="partnerId" value={partnerId} />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="partnerId">파트너</Label>
              <select
                id="partnerId"
                name="partnerId"
                required
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              >
                {partners?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {initial?.startDate && <input type="hidden" name="startDate" value={initial.startDate} />}
          {initial?.sourceGoogleEventId && (
            <input type="hidden" name="sourceGoogleEventId" value={initial.sourceGoogleEventId} />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="title">제목</Label>
            <Input id="title" name="title" defaultValue={initial?.title} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="memo">메모</Label>
            <Textarea id="memo" name="memo" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>링크</Label>
            <LinkFields />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">기한</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={initial?.dueDate} />
          </div>
          {projectOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="parentId">+ 상위 프로젝트 설정</Label>
              <select
                id="parentId"
                name="parentId"
                defaultValue=""
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              >
                <option value="">(없음)</option>
                {projectOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <UserPicker
            excludeIds={[currentUserId]}
            selected={participants}
            onChange={setParticipants}
            label="+ 참여자 추가"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="recurrence" value="WEEKLY" className="size-4" />
            매주 반복 (완료 시 다음 회차 자동 생성)
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="visibility">공개 범위</Label>
            <select
              id="visibility"
              name="visibility"
              defaultValue="PUBLIC"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            >
              <option value="PUBLIC">공개</option>
              <option value="PRIVATE">비공개</option>
            </select>
          </div>
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "생성 중..." : "만들기"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
