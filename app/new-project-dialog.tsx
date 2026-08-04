"use client";

import { useActionState, useState } from "react";
import { createProject } from "@/app/actions/projects";
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

export function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [errorMessage, formAction, isPending] = useActionState(
    createProject,
    undefined,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>새 프로젝트</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 프로젝트</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">이름</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goalDate">목표일</Label>
            <Input id="goalDate" name="goalDate" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visibility">공개 범위</Label>
            <select
              id="visibility"
              name="visibility"
              defaultValue="PRIVATE"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            >
              <option value="PRIVATE">비공개</option>
              <option value="PUBLIC">공개</option>
            </select>
          </div>
          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "생성 중..." : "만들기"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
