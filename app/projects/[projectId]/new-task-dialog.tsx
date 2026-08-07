"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTask } from "@/app/actions/tasks";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewTaskDialog({
  projectId,
  projects,
}: {
  projectId?: string;
  projects?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, formAction, isPending] = useActionState(createTask, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
    }
  }, [isPending, errorMessage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          projectId ? (
            <Button size="sm">새 업무</Button>
          ) : (
            <Button size="icon-sm" variant="outline" title="새 업무" aria-label="새 업무">
              <IconPlus />
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 업무</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => {
            submitted.current = true;
          }}
          className="space-y-4"
        >
          {projectId ? (
            <input type="hidden" name="projectId" value={projectId} />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="projectId">프로젝트</Label>
              <select
                id="projectId"
                name="projectId"
                required
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              >
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="title">제목</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="memo">메모</Label>
            <Textarea id="memo" name="memo" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">기한</Label>
            <Input id="dueDate" name="dueDate" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">태그 (쉼표로 구분)</Label>
            <Input id="tags" name="tags" placeholder="예: 프론트엔드, 급함" />
          </div>
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
