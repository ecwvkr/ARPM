"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { archiveProject } from "@/app/actions/projects";
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
  projectId,
  onDeleted,
  trigger,
}: {
  projectId: string;
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
          <DialogTitle>보관함으로 이동</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          목록에서 사라지지만 데이터는 남아 있어 설정 &gt; 보관함에서 복구하거나 영구 삭제할
          수 있습니다. 하위 프로젝트도 함께 보관됩니다.
        </p>
        <DeleteForm projectId={projectId} onDeleted={onDeleted} />
      </DialogContent>
    </Dialog>
  );
}

function DeleteForm({ projectId, onDeleted }: { projectId: string; onDeleted: () => void }) {
  const action = archiveProject.bind(null, projectId);
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
        보관함으로 이동
      </Button>
    </form>
  );
}
