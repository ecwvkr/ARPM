"use client";

import { useEffect, useState, useTransition } from "react";
import {
  joinProject,
  leaveProject,
  removeParticipant,
  transferMaster,
  inviteToProject,
  listProjectInviteCandidates,
} from "@/app/actions/projects";
import { listAllUsers } from "@/app/actions/users";
import { useDetailSubmit } from "./use-detail-submit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectTreePicker } from "./project-tree-picker";
import { PriorityDot } from "./project-priority-picker";
import { PRIORITY_LABEL } from "@/lib/priority";
import { showToast } from "@/components/ui/global-toast";
import type { ParticipantChipData } from "@/lib/priority";
import { IconPlus, IconX, IconAlertTriangle } from "@tabler/icons-react";

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

  // 생성자(master)를 항상 맨 앞에 두고 나머지는 그 뒤로(프로젝트 5).
  const master = participantChips.find((p) => p.isMaster);
  const others = participantChips.filter((p) => !p.isMaster);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="shrink-0 text-muted-foreground">생성자</span>
        {master && (
          <span
            title={`${master.userName}: ${PRIORITY_LABEL[master.level]}`}
            className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"
          >
            {/* 긴급도 '표기'는 여기 그대로 두고, '설정'만 상태 섹션으로 분리했다(프로젝트 13). */}
            <PriorityDot level={master.level} className="translate-y-px" />
            {master.userName}
          </span>
        )}
        {canManage && <MasterDelegateDialog projectId={projectId} onDone={onDone} />}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="shrink-0 text-muted-foreground">참여멤버</span>
        {others.length === 0 && <span className="text-muted-foreground">없음</span>}
        {others.map((p) => (
          <span
            key={p.userId}
            title={`${p.userName}: ${PRIORITY_LABEL[p.level]}`}
            className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"
          >
            <PriorityDot level={p.level} className="translate-y-px" />
            {p.userName}
            {canManage && (
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
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>참여자 추가</DialogTitle>
          </DialogHeader>
          {showInvite && (
            <InviteForm
              projectId={projectId}
              onDone={() => {
                setShowInvite(false);
                onDone();
              }}
              excludeIds={excludeIds}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 담당자(master) 변경은 되돌리려면 다시 위임해야 하는 조작이라 확인 단계를 둔다(프로젝트 1).
function MasterDelegateDialog({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[] | null>(null);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && !users) listAllUsers().then(setUsers);
  }, [open, users]);

  function confirmDelegate() {
    if (!target) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", target.id);
      await transferMaster(projectId, formData);
      setTarget(null);
      setOpen(false);
      showToast("담당자가 변경되었습니다");
      onDone();
    });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button type="button" className="text-muted-foreground underline underline-offset-2">
              변경하기
            </button>
          }
        />
        <PopoverContent className="w-44 gap-0.5 p-1.5" align="start">
          <p className="px-2 pt-1 text-xs text-muted-foreground">담당자 변경</p>
          {!users ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">불러오는 중...</p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTarget(u);
                }}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                {u.name}
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={!!target} onOpenChange={(next) => !next && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>담당자 변경</DialogTitle>
          </DialogHeader>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              담당자를 <span className="font-medium text-foreground">{target?.name}</span>님으로 변경합니다. 변경 후에는
              현재 담당자가 이 프로젝트를 수정할 수 없게 됩니다. 계속하시겠습니까?
            </span>
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setTarget(null)}>
              아니요
            </Button>
            <Button size="sm" disabled={isPending} onClick={confirmDelegate}>
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
  const [candidates, setCandidates] = useState<{
    partnerMembers: { id: string; name: string }[];
    outsiders: { id: string; name: string }[];
  } | null>(null);
  const [ackOutsider, setAckOutsider] = useState(false);

  useEffect(() => {
    listProjectInviteCandidates(projectId, excludeIds).then(setCandidates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!candidates) return <p className="text-sm text-muted-foreground">불러오는 중...</p>;

  const outsiderIds = new Set(candidates.outsiders.map((u) => u.id));
  const selectedOutsiders = selected.filter((id) => outsiderIds.has(id));
  const needsAck = selectedOutsiders.length > 0;
  const outsiderNames = candidates.outsiders.filter((u) => selectedOutsiders.includes(u.id)).map((u) => u.name);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function chipClassFor(id: string) {
    return selected.includes(id)
      ? "rounded-full bg-primary px-2.5 py-1 text-xs text-primary-foreground"
      : "rounded-full bg-muted px-2.5 py-1 text-xs";
  }

  return (
    <form
      action={(formData) => {
        formData.set("grants", JSON.stringify(grants));
        formData.set("role", role);
        selected.forEach((userId) => formData.append("userIds", userId));
        submit(formData, () => {
          showToast("초대되었습니다");
          onDone();
        });
      }}
      className="space-y-3"
    >
      {/* 파트너 참여 여부에 따라 후보를 나눠 보여준다(프로젝트 2·3). */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">이 파트너에 참여 중</p>
        {candidates.partnerMembers.length === 0 ? (
          <p className="text-xs text-muted-foreground">추가할 수 있는 참여자가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {candidates.partnerMembers.map((u) => (
              <button key={u.id} type="button" aria-pressed={selected.includes(u.id)} onClick={() => toggle(u.id)} className={chipClassFor(u.id)}>
                {u.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {candidates.outsiders.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconAlertTriangle className="size-3.5 text-destructive" />
            파트너 미참여
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidates.outsiders.map((u) => (
              <button key={u.id} type="button" aria-pressed={selected.includes(u.id)} onClick={() => toggle(u.id)} className={chipClassFor(u.id)}>
                {u.name}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* 미참여자를 고르면 파트너에도 자동 참여된다는 사실을 체크박스로 확인받는다(프로젝트 4·6). */}
      {needsAck && (
        <label className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-xs">
          <Checkbox checked={ackOutsider} onCheckedChange={(v) => setAckOutsider(v === true)} className="mt-0.5" />
          <span>
            <span className="font-medium">{outsiderNames.join(", ")}</span>님은 이 파트너에 참여하고 있지 않습니다.
            초대하면 파트너 업무에도 자동으로 참여됩니다. 계속하시겠습니까?
          </span>
        </label>
      )}

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          아니요
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || grants.length === 0 || selected.length === 0 || (needsAck && !ackOutsider)}
        >
          확인
        </Button>
      </div>
    </form>
  );
}
