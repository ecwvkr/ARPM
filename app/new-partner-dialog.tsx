"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { createPartner, checkPartnerName } from "@/app/actions/partners";
import { listAllUsers } from "@/app/actions/users";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPicker } from "@/components/user-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewPartnerDialog({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [errorMessage, formAction, isPending] = useActionState(
    createPartner,
    undefined,
  );
  const [members, setMembers] = useState<string[]>([]);
  // 이름 중복 확인(파트너 1): 저장 전에 물어보고 '예'면 제안 이름으로 바꿔 다시 제출한다.
  const formRef = useRef<HTMLFormElement>(null);
  const [dupPrompt, setDupPrompt] = useState<{ suggested: string } | null>(null);
  const bypassCheck = useRef(false);
  const [isChecking, startTransition] = useTransition();

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="icon-sm" variant="outline" title="새 파트너" aria-label="새 파트너">
            <IconPlus />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 파트너</DialogTitle>
        </DialogHeader>
        <form
          ref={formRef}
          onSubmit={(e) => {
            if (bypassCheck.current) {
              bypassCheck.current = false;
              return;
            }
            const form = e.currentTarget;
            const nameValue = (new FormData(form).get("name") as string | null)?.trim() ?? "";
            if (!nameValue) return;
            e.preventDefault();
            startTransition(async () => {
              const result = await checkPartnerName(nameValue);
              if (result.duplicate) setDupPrompt({ suggested: result.suggested });
              else {
                bypassCheck.current = true;
                form.requestSubmit();
              }
            });
          }}
          action={(formData) => {
            members.forEach((userId) => formData.append("userIds", userId));
            formAction(formData);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">파트너 명</Label>
            <Input id="name" name="name" required />
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>+ 참여자 설정</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() =>
                  listAllUsers().then((users) =>
                    setMembers(users.filter((u) => u.id !== currentUserId).map((u) => u.id)),
                  )
                }
              >
                모두참여
              </button>
            </div>
            <UserPicker excludeIds={[currentUserId]} selected={members} onChange={setMembers} label="" />
          </div>
          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          <Button type="submit" disabled={isPending || isChecking} className="w-full">
            {isPending ? "생성 중..." : "만들기"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>

      <Dialog open={!!dupPrompt} onOpenChange={(next) => !next && setDupPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>중복된 파트너 이름이 있습니다.</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &apos;{dupPrompt?.suggested}&apos; 형태로 만드시겠습니까?
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setDupPrompt(null)}>
              아니요
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const form = formRef.current;
                const input = form?.elements.namedItem("name") as HTMLInputElement | null;
                if (form && input && dupPrompt) {
                  input.value = dupPrompt.suggested;
                  setDupPrompt(null);
                  bypassCheck.current = true;
                  form.requestSubmit();
                }
              }}
            >
              예
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
