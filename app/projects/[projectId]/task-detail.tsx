"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  getTaskDetail,
  joinTask,
  leaveTask,
  updateTaskStatus,
  completeTask,
  reopenTask,
  extendDueDate,
  updateTaskInfo,
  updateTaskVisibility,
  transferMaster,
  inviteToTask,
  removeParticipant,
  addComment,
  updateComment,
  deleteComment,
  deleteTask,
  duplicateTask,
  moveTask,
  listMovableTargets,
} from "@/app/actions/tasks";
import { listAllUsers } from "@/app/actions/users";
import { STATUS_LABEL, isOverdue, buildParticipantChips } from "@/lib/priority";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconCopy, IconArrowsMove, IconPencil, IconTrash, IconX, IconPlus, IconLink } from "@tabler/icons-react";
import { TaskTreePicker } from "./task-tree-picker";
import { UserPicker } from "@/components/user-picker";
import { DeriveDialog } from "./task-derive-dialog";
import { DeleteDialog } from "./task-delete-dialog";
import { ParticipantPriorityDot } from "./task-priority-picker";
import { useSavedToast } from "@/components/ui/saved-toast";

type Detail = Awaited<ReturnType<typeof getTaskDetail>>;

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR");
}

export function TaskDetail({ taskId, onDeleted }: { taskId: string; onDeleted: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingInfo, setEditingInfo] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const { toast, trigger: showSavedToast } = useSavedToast();

  const reload = () => {
    startTransition(async () => {
      setDetail(await getTaskDetail(taskId));
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // ponytail: 각 액션은 이미 revalidatePath를 호출하므로 Next가 페이지를 자동으로
  // 갱신한다. 여기서 router.refresh()까지 또 부르면 같은 화면을 두 번 새로고침하게 되어 제거.
  const afterMutation = () => {
    reload();
  };

  if (detail === null) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">불러오는 중...</p>;
  }

  if (!detail.task) {
    return (
      <p className="px-1 py-4 text-sm text-muted-foreground">
        업무를 찾을 수 없거나 접근 권한이 없습니다.
      </p>
    );
  }

  const {
    task,
    canManage,
    canParticipantAct,
    canComment,
    canJoin,
    canLeave,
    currentUserId,
    isSuperAdmin,
    commentVisibleCount,
  } = detail;
  const overdue = isOverdue(task.dueDate, task.status);
  const locked = task.completedAt !== null;
  const participantChips = buildParticipantChips(task);

  return (
    <div className="space-y-9 px-1 pb-8">
      <section className="space-y-2 border-b border-foreground/10 pb-4">
        {editingInfo ? (
          <EditInfoForm
            taskId={taskId}
            title={task.title}
            memo={task.memo ?? ""}
            link={task.link ?? ""}
            onDone={() => {
              setEditingInfo(false);
              afterMutation();
            }}
            onCancel={() => setEditingInfo(false)}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{task.title}</h2>
                <Badge variant={task.status === "DONE" ? "secondary" : "default"}>
                  {STATUS_LABEL[task.status]}
                </Badge>
                {overdue && <Badge variant="destructive">지연</Badge>}
                <Badge variant={task.visibility === "PUBLIC" ? "secondary" : "outline"}>
                  {task.visibility === "PUBLIC" ? "공개" : "비공개"}
                </Badge>
                {task.recurrence === "WEEKLY" && <Badge variant="outline">매주 반복</Badge>}
              </div>
              {canManage && !locked && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="수정"
                  aria-label="업무 정보 수정"
                  onClick={() => setEditingInfo(true)}
                >
                  <IconPencil />
                </Button>
              )}
            </div>
            {task.memo && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.memo}</p>}
            {task.link && (
              <a
                href={task.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit max-w-full items-center gap-1 text-sm text-primary underline underline-offset-2"
              >
                <IconLink className="size-4 shrink-0" />
                <span className="truncate">{task.link}</span>
              </a>
            )}
          </>
        )}
        {task.parent && (
          <p className="text-xs text-muted-foreground">상위 업무: {task.parent.title}</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {canParticipantAct && !locked && (
              <>
                <Button
                  size="sm"
                  variant={task.status === "TODO" ? "default" : "outline"}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await updateTaskStatus(taskId, "TODO");
                      afterMutation();
                    })
                  }
                >
                  진행전
                </Button>
                <Button
                  size="sm"
                  variant={task.status === "IN_PROGRESS" ? "default" : "outline"}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await updateTaskStatus(taskId, "IN_PROGRESS");
                      afterMutation();
                    })
                  }
                >
                  진행중
                </Button>
                <CompleteConfirmDialog taskId={taskId} onDone={afterMutation} />
              </>
            )}
            {locked && (canManage || isSuperAdmin) && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await reopenTask(taskId);
                    afterMutation();
                  })
                }
              >
                완료 취소
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <DeriveDialog
              parentTaskId={taskId}
              onDone={afterMutation}
              trigger={
                <Button size="sm" variant="outline" title="이 업무의 하위 연계 업무를 새로 만듭니다">
                  <IconPlus className="size-4" />
                  연계업무
                </Button>
              }
            />
            <Button
              size="sm"
              variant="outline"
              title="현재 업무를 그대로 복제합니다"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await duplicateTask(taskId);
                  afterMutation();
                })
              }
            >
              <IconCopy className="size-4" />
              업무 복제
            </Button>
            {canManage && (
              <MoveDialog taskId={taskId} currentParentId={task.parentId} onDone={afterMutation} />
            )}
          </div>
        </div>

        {canParticipantAct && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {task.dueDate ? `마감일 ${formatDate(task.dueDate)}` : "마감일이 설정되지 않았습니다."}
            </span>
            <ExtendDueDatePopover taskId={taskId} onDone={afterMutation} />
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">참여자 ({participantChips.length})</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {participantChips.map((p) => (
            <span
              key={p.userId}
              className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              <ParticipantPriorityDot
                taskId={taskId}
                userId={p.userId}
                userName={p.userName}
                level={p.level}
                currentUserId={currentUserId}
              />
              {p.isMaster && canManage ? (
                <MasterDelegatePopover taskId={taskId} currentMasterName={p.userName} onDone={afterMutation} />
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
                      await removeParticipant(taskId, p.userId);
                      afterMutation();
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
                  await joinTask(taskId);
                  afterMutation();
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
                  await leaveTask(taskId);
                  afterMutation();
                })
              }
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive"
            >
              빠지기
            </button>
          )}
        </div>
      </section>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>참여자 추가</DialogTitle>
          </DialogHeader>
          <InviteForm
            taskId={taskId}
            onDone={() => {
              setShowInvite(false);
              afterMutation();
            }}
            excludeIds={[task.master.id, ...task.participants.map((p) => p.userId)]}
          />
        </DialogContent>
      </Dialog>

      {canManage && (
        <>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold tracking-wider text-muted-foreground/70 uppercase">설정</p>
            <div className="h-px flex-1 bg-foreground/10" />
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">공개 범위</h3>
            <select
              name="visibility"
              aria-label="공개 범위"
              defaultValue={task.visibility}
              disabled={isPending}
              onChange={(e) => {
                const formData = new FormData();
                formData.set("visibility", e.target.value);
                startTransition(async () => {
                  await updateTaskVisibility(taskId, formData);
                  afterMutation();
                  showSavedToast();
                });
              }}
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
            >
              <option value="PUBLIC">공개</option>
              <option value="PRIVATE">비공개</option>
            </select>
          </section>
        </>
      )}

      <div className="flex items-center gap-2">
        <p className="text-xs font-bold tracking-wider text-muted-foreground/70 uppercase">협업</p>
        <div className="h-px flex-1 bg-foreground/10" />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">코멘트 ({task.comments.length})</h3>
        {!showAllComments && task.comments.length > commentVisibleCount && (
          <button
            type="button"
            onClick={() => setShowAllComments(true)}
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            ... 이전 코멘트 {task.comments.length - commentVisibleCount}개 더보기
          </button>
        )}
        <ul className="space-y-2">
          {(showAllComments ? task.comments : task.comments.slice(-commentVisibleCount)).map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              canEdit={c.authorId === currentUserId || isSuperAdmin}
              onDone={afterMutation}
            />
          ))}
        </ul>
        {canComment && (
          <CommentForm
            taskId={taskId}
            onDone={afterMutation}
            candidates={[
              { userId: task.master.id, userName: task.master.name },
              ...task.participants.map((p) => ({ userId: p.userId, userName: p.user.name })),
            ].filter((c, i, arr) => arr.findIndex((x) => x.userId === c.userId) === i)}
          />
        )}
      </section>

      {canManage && <DangerZone taskId={taskId} onDeleted={onDeleted} />}
      {toast}
    </div>
  );
}

function DangerZone({ taskId, onDeleted }: { taskId: string; onDeleted: () => void }) {
  return (
    <div className="flex justify-end">
      <DeleteDialog taskId={taskId} onDeleted={onDeleted} />
    </div>
  );
}

// useActionState의 formAction은 액션이 돌려준 오류 문자열을 호출부에 넘겨주지 않는다.
// 그래서 이 파일의 폼들은 "await formAction(); onDone()"으로 실패해도 그대로 닫혔고,
// 사용자가 입력한 내용이 조용히 사라졌다. 액션을 직접 호출해 성공했을 때만 닫는다.
function useSubmit(
  action: (prevState: string | undefined, formData: FormData) => Promise<string | undefined>,
) {
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData, onSuccess: () => void) {
    startTransition(async () => {
      const error = await action(undefined, formData);
      setErrorMessage(error);
      if (!error) onSuccess();
    });
  }

  return { errorMessage, isPending, submit };
}

function EditInfoForm({
  taskId,
  title,
  memo,
  link,
  onDone,
  onCancel,
}: {
  taskId: string;
  title: string;
  memo: string;
  link: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { errorMessage, isPending, submit } = useSubmit(updateTaskInfo.bind(null, taskId));

  return (
    <form
      action={(formData) => submit(formData, onDone)}
      className="space-y-2"
    >
      <Input name="title" defaultValue={title} required />
      <Textarea name="memo" defaultValue={memo} placeholder="메모" rows={3} />
      <Input name="link" defaultValue={link} placeholder="링크 (https://example.com)" />
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          저장
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

function MasterDelegatePopover({
  taskId,
  currentMasterName,
  onDone,
}: {
  taskId: string;
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
      await transferMaster(taskId, formData);
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

function ExtendDueDatePopover({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const action = extendDueDate.bind(null, taskId);
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" variant="outline">연장</Button>} />
      <PopoverContent className="w-auto gap-2 p-3">
        <form
          action={formAction}
          onSubmit={() => {
            submitted.current = true;
          }}
          className="flex items-center gap-2"
        >
          <Input name="dueDate" type="date" className="w-auto" required />
          <Button type="submit" size="sm" disabled={isPending}>
            연장
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
        </form>
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </PopoverContent>
    </Popover>
  );
}

function CompleteConfirmDialog({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">완료하기</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>업무 완료</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">완료 시 수정이 불가능합니다. 완료하시겠습니까?</p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            아니요
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await completeTask(taskId);
                setOpen(false);
                onDone();
              })
            }
          >
            네
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({
  taskId,
  onDone,
  excludeIds,
}: {
  taskId: string;
  onDone: () => void;
  excludeIds: string[];
}) {
  const { errorMessage, isPending, submit } = useSubmit(inviteToTask.bind(null, taskId));
  const [grants, setGrants] = useState<{ taskId: string; includeSubtree: boolean }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <form
      action={(formData) => {
        formData.set("grants", JSON.stringify(grants));
        selected.forEach((userId) => formData.append("userIds", userId));
        submit(formData, onDone);
      }}
      className="space-y-2"
    >
      <UserPicker excludeIds={excludeIds} selected={selected} onChange={setSelected} label="초대할 참여자" />
      <TaskTreePicker rootTaskId={taskId} onChange={setGrants} />
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" disabled={isPending || grants.length === 0 || selected.length === 0}>
        초대
      </Button>
    </form>
  );
}

function MoveDialog({
  taskId,
  currentParentId,
  onDone,
}: {
  taskId: string;
  currentParentId: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" title="이 업무의 상위 연계 업무를 변경합니다">
            <IconArrowsMove className="size-4" />
            연계업무 수정
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>연계업무 수정</DialogTitle>
        </DialogHeader>
        <MoveForm
          taskId={taskId}
          currentParentId={currentParentId}
          onDone={() => {
            setOpen(false);
            onDone();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function MoveForm({
  taskId,
  currentParentId,
  onDone,
}: {
  taskId: string;
  currentParentId: string | null;
  onDone: () => void;
}) {
  const [targets, setTargets] = useState<{ id: string; title: string }[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listMovableTargets(taskId).then(setTargets);
  }, [taskId]);

  if (!targets) return <p className="text-sm text-muted-foreground">불러오는 중...</p>;

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await moveTask(taskId, formData);
          onDone();
        })
      }
      className="flex items-center gap-2"
    >
      <select
        name="parentId"
        aria-label="부모 업무"
        defaultValue={currentParentId ?? ""}
        className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
      >
        <option value="">(최상위)</option>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        이동
      </Button>
    </form>
  );
}

function CommentItem({
  comment,
  canEdit,
  onDone,
}: {
  comment: { id: string; body: string; author: { name: string } };
  canEdit: boolean;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { errorMessage, isPending, submit } = useSubmit(updateComment.bind(null, comment.id));
  const [isDeleting, startTransition] = useTransition();

  if (editing) {
    return (
      <li className="rounded-md bg-muted/50 p-2 text-sm">
        <form
          action={(formData) =>
            submit(formData, () => {
              setEditing(false);
              onDone();
            })
          }
          className="space-y-1.5"
        >
          <Textarea name="body" defaultValue={comment.body} rows={2} required />
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              저장
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-md bg-muted/50 p-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{comment.author.name}</p>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="코멘트 수정"
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <IconPencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="코멘트 삭제"
              disabled={isDeleting}
              onClick={() =>
                startTransition(async () => {
                  await deleteComment(comment.id);
                  onDone();
                })
              }
              className="text-muted-foreground hover:text-destructive"
            >
              <IconTrash className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <p className="whitespace-pre-wrap">{comment.body}</p>
    </li>
  );
}

function CommentForm({
  taskId,
  onDone,
  candidates,
}: {
  taskId: string;
  onDone: () => void;
  candidates: { userId: string; userName: string }[];
}) {
  const { errorMessage, isPending, submit } = useSubmit(addComment.bind(null, taskId));
  const [notify, setNotify] = useState<string[]>([]);

  return (
    <form
      action={(formData) => {
        notify.forEach((userId) => formData.append("notify", userId));
        submit(formData, () => {
          setNotify([]);
          onDone();
        });
      }}
      className="space-y-2"
    >
      <Textarea name="body" placeholder="코멘트를 입력하세요" rows={2} required />
      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>알릴 사람:</span>
          {candidates.map((c) => {
            const active = notify.includes(c.userId);
            return (
              <button
                key={c.userId}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setNotify((prev) =>
                    prev.includes(c.userId) ? prev.filter((id) => id !== c.userId) : [...prev, c.userId],
                  )
                }
                className={
                  active
                    ? "rounded-full bg-primary px-2 py-0.5 text-primary-foreground"
                    : "rounded-full bg-muted px-2 py-0.5"
                }
              >
                @{c.userName}
              </button>
            );
          })}
        </div>
      )}
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        등록
      </Button>
    </form>
  );
}
