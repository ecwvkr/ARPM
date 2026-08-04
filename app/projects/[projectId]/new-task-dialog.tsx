"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTask } from "@/app/actions/tasks";
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

export function NewTaskDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const action = createTask.bind(null, projectId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
    }
  }, [isPending, errorMessage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">새 업무</Button>} />
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
