"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconTrash } from "@tabler/icons-react";

export function DeleteDialog({
  taskId,
  onDeleted,
  trigger,
}: {
  taskId: string;
  onDeleted: () => void;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="icon-sm" variant="destructive" title="삭제하기" aria-label="삭제하기">
              <IconTrash />
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>업무 삭제</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          이 작업은 되돌릴 수 없습니다. 하위 업무는 상위 업무로 승격됩니다.
        </p>
        <DeleteForm taskId={taskId} onDeleted={onDeleted} />
      </DialogContent>
    </Dialog>
  );
}

function DeleteForm({ taskId, onDeleted }: { taskId: string; onDeleted: () => void }) {
  const action = deleteTask.bind(null, taskId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      onDeleted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submitted.current = true;
      }}
      className="space-y-2"
    >
      <Label htmlFor="confirm" className="text-xs text-muted-foreground">
        확인을 위해 &apos;삭제&apos;를 입력하세요.
      </Label>
      <Input id="confirm" name="confirm" required />
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
        영구 삭제
      </Button>
    </form>
  );
}
