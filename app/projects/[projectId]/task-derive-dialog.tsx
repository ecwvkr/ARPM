"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deriveTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LinkFields } from "@/components/link-fields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconPlus } from "@tabler/icons-react";

export function DeriveDialog({
  parentTaskId,
  onDone,
  trigger,
}: {
  parentTaskId: string;
  onDone: () => void;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const action = deriveTask.bind(null, parentTaskId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="icon-sm" variant="outline" title="연계업무 생성" aria-label="연계업무 생성">
              <IconPlus />
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>연계업무 생성</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => {
            submitted.current = true;
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="derive-title">제목</Label>
            <Input id="derive-title" name="title" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="derive-memo">메모</Label>
            <Textarea id="derive-memo" name="memo" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>링크</Label>
            <LinkFields />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="derive-dueDate">기한</Label>
            <Input id="derive-dueDate" name="dueDate" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="derive-visibility">공개 범위</Label>
            <select
              id="derive-visibility"
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
            {isPending ? "생성 중..." : "생성하기"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
