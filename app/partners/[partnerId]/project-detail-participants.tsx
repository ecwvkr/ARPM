"use client";

import { useEffect, useState, useTransition } from "react";
import {
  joinProject,
  leaveProject,
  removeParticipant,
  transferMaster,
  inviteToProject,
} from "@/app/actions/projects";
import { listAllUsers } from "@/app/actions/users";
import { useDetailSubmit } from "./use-detail-submit";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPicker } from "@/components/user-picker";
import { ProjectTreePicker } from "./project-tree-picker";
import { ParticipantPriorityDot } from "./project-priority-picker";
import type { ParticipantChipData } from "@/lib/priority";
import { IconPlus, IconX } from "@tabler/icons-react";

export function ProjectDetailParticipants({
  projectId,
  participantChips,
  currentUserId,
  canManage,
  canJoin,
  canLeave,
  excludeIds,
  onDone,
}: {
  projectId: string;
  participantChips: ParticipantChipData[];
  currentUserId: string;
  canManage: boolean;
  canJoin: boolean;
  canLeave: boolean;
  excludeIds: string[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {participantChips.map((p) => (
        <span
          key={p.userId}
          className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
        >
          <ParticipantPriorityDot
            projectId={projectId}
            userId={p.userId}
            userName={p.userName}
            level={p.level}
            currentUserId={currentUserId}
          />
          {p.isMaster && canManage ? (
            <MasterDelegatePopover projectId={projectId} currentMasterName={p.userName} onDone={onDone} />
          ) : (
            <span>
              {p.userName}
              {p.isMaster && " · master"}
            </span>
          )}
          {canManage && !p.isMaster && (
            <button
              type="button"
              aria-label={`${p.userName} 참여자 제외`}
              onClick={() =>
                startTransition(async () => {
                  await removeParticipant(projectId, p.userId);
                  onDone();
                })
              }
              className="text-muted-foreground/60 hover:text-destructive"
            >
              <IconX className="size-3" />
            </button>
          )}
        </span>
      ))}
      {canManage && (
        <Button
          size="icon-sm"
          variant="outline"
          title="참여자 추가"
          aria-label="참여자 추가"
          onClick={() => setShowInvite(true)}
        >
          <IconPlus className="size-4" />
        </Button>
      )}
      {canJoin && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await joinProject(projectId);
              onDone();
            })
          }
        >
          참가하기
        </Button>
      )}
      {canLeave && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await leaveProject(projectId);
              onDone();
            })
          }
          className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive"
        >
          빠지기
        </button>
      )}

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>참여자 추가</DialogTitle>
          </DialogHeader>
          <InviteForm
            projectId={projectId}
            onDone={() => {
              setShowInvite(false);
              onDone();
            }}
            excludeIds={excludeIds}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MasterDelegatePopover({
  projectId,
  currentMasterName,
  onDone,
}: {
  projectId: string;
  currentMasterName: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && !users) listAllUsers().then(setUsers);
  }, [open, users]);

  function delegate(userId: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      await transferMaster(projectId, formData);
      setOpen(false);
      onDone();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button type="button" className="underline underline-offset-2">
            {currentMasterName} · master
          </button>
        }
      />
      <PopoverContent className="w-48 gap-1 p-1.5">
        <p className="px-2 pt-1 text-xs text-muted-foreground">master 위임</p>
        {!users ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">불러오는 중...</p>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={isPending}
              onClick={() => delegate(u.id)}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              {u.name}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

function InviteForm({
  projectId,
  onDone,
  excludeIds,
}: {
  projectId: string;
  onDone: () => void;
  excludeIds: string[];
}) {
  const { errorMessage, isPending, submit } = useDetailSubmit(inviteToProject.bind(null, projectId));
  const [grants, setGrants] = useState<{ projectId: string; includeSubtree: boolean }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [role, setRole] = useState<"MEMBER" | "VIEWER">("MEMBER");

  return (
    <form
      action={(formData) => {
        formData.set("grants", JSON.stringify(grants));
        formData.set("role", role);
        selected.forEach((userId) => formData.append("userIds", userId));
        submit(formData, onDone);
      }}
      className="space-y-2"
    >
      <UserPicker excludeIds={excludeIds} selected={selected} onChange={setSelected} label="초대할 참여자" />
      <ProjectTreePicker rootProjectId={projectId} onChange={setGrants} />
      <div className="flex gap-1.5 text-xs">
        <button
          type="button"
          className={role === "MEMBER" ? "underline underline-offset-2" : "text-muted-foreground"}
          onClick={() => setRole("MEMBER")}
        >
          일반 참여자
        </button>
        <button
          type="button"
          className={role === "VIEWER" ? "underline underline-offset-2" : "text-muted-foreground"}
          onClick={() => setRole("VIEWER")}
        >
          읽기 전용(코멘트만 가능)
        </button>
      </div>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" disabled={isPending || grants.length === 0 || selected.length === 0}>
        초대
      </Button>
    </form>
  );
}
