"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  getTaskDetail,
  joinTask,
  leaveTask,
  updateTaskStatus,
  completeTask,
  extendDueDate,
  updateTaskInfo,
  updateTaskVisibility,
  transferMaster,
  inviteToTask,
  addComment,
  addTaskLink,
  deleteTaskLink,
  deleteTask,
  deriveTask,
  moveTask,
  listMovableTargets,
  setMyPriority,
} from "@/app/actions/tasks";
import { PRIORITY_LABEL, PRIORITY_COLOR, STATUS_LABEL, isOverdue } from "@/lib/priority";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TaskTreePicker } from "./task-tree-picker";
import { UserPicker } from "@/components/user-picker";

type Detail = Awaited<ReturnType<typeof getTaskDetail>>;

export function TaskDetail({ taskId, onDeleted }: { taskId: string; onDeleted: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isPending, startTransition] = useTransition();
  // ponytail: 공유 관리/부모 변경은 드로어를 열자마자가 아니라 실제로 펼쳤을 때만 불러온다
  // (각각 프로젝트 전체 업무 트리를 다시 조회하는 무거운 호출이라 미리 불러올 필요가 없음).
  const [showInvite, setShowInvite] = useState(false);
  const [showMove, setShowMove] = useState(false);

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

  if (!detail || !detail.task) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">불러오는 중...</p>;
  }

  const { task, canManage, canParticipantAct, canComment, canJoin, canLeave } = detail;
  const overdue = isOverdue(task.dueDate, task.status);
  const locked = task.completedAt !== null;

  return (
    <div className="space-y-6 px-1 pb-8">
      <section className="space-y-2 border-b border-foreground/10 pb-4">
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
        {task.memo && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.memo}</p>}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">master: {task.master.name}</p>
        {task.parent && (
          <p className="text-xs text-muted-foreground">상위 업무: {task.parent.title}</p>
        )}
      </section>

      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold tracking-wider text-muted-foreground/70 uppercase">진행 관리</p>
        <div className="h-px flex-1 bg-foreground/10" />
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">파생</h3>
        <DeriveDialog parentTaskId={taskId} onDone={afterMutation} />
      </section>

      {canParticipantAct && !locked && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">상태</h3>
          <div className="flex gap-2">
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
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await completeTask(taskId);
                  afterMutation();
                })
              }
            >
              완료하기
            </Button>
          </div>
        </section>
      )}

      {canParticipantAct && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">기한 연장</h3>
          <ExtendDueDateForm taskId={taskId} onDone={afterMutation} />
        </section>
      )}

      {detail.canSetPriority && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">내 우선순위</h3>
          <div className="flex gap-2">
            {(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((level) => (
              <Button
                key={level}
                size="sm"
                variant={detail.myPriority === level ? "default" : "outline"}
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await setMyPriority(taskId, level);
                    afterMutation();
                  })
                }
              >
                <span
                  className="mr-1.5 inline-block size-2 rounded-full"
                  style={{ backgroundColor: PRIORITY_COLOR[level] }}
                />
                {PRIORITY_LABEL[level]}
              </Button>
            ))}
          </div>
        </section>
      )}

      {(canJoin || canLeave) && (
        <section>
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
              참여하기
            </Button>
          )}
          {canLeave && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await leaveTask(taskId);
                  afterMutation();
                })
              }
            >
              이탈하기
            </Button>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">참여자 ({task.participants.length})</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {task.participants.map((p) => (
            <li key={p.userId}>
              {p.user.name}
              {p.userId === task.masterId ? " · master" : ""}
              {!p.includeSubtree && " · 해당 업무만"}
            </li>
          ))}
        </ul>
      </section>

      {canManage && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground/70 uppercase">설정</p>
            <div className="h-px flex-1 bg-foreground/10" />
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">업무 정보 수정</h3>
            <EditInfoForm
              taskId={taskId}
              title={task.title}
              memo={task.memo ?? ""}
              tags={task.tags}
              onDone={afterMutation}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">공개 범위</h3>
            <form
              action={(formData) =>
                startTransition(async () => {
                  await updateTaskVisibility(taskId, formData);
                  afterMutation();
                })
              }
              className="flex items-center gap-2"
            >
              <select
                name="visibility"
                aria-label="공개 범위"
                defaultValue={task.visibility}
                className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
              >
                <option value="PUBLIC">공개</option>
                <option value="PRIVATE">비공개</option>
              </select>
              <Button type="submit" size="sm" variant="outline" disabled={isPending}>
                저장
              </Button>
            </form>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">참여자 초대 (공유 범위 지정)</h3>
              {!showInvite && (
                <Button size="sm" variant="outline" onClick={() => setShowInvite(true)}>
                  열기
                </Button>
              )}
            </div>
            {showInvite && (
              <InviteForm
                taskId={taskId}
                onDone={afterMutation}
                excludeIds={[task.master.id, ...task.participants.map((p) => p.userId)]}
              />
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">부모 변경</h3>
              {!showMove && (
                <Button size="sm" variant="outline" onClick={() => setShowMove(true)}>
                  열기
                </Button>
              )}
            </div>
            {showMove && (
              <MoveForm taskId={taskId} currentParentId={task.parentId} onDone={afterMutation} />
            )}
          </section>

          {task.participants.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">master 위임</h3>
              <form
                action={(formData) =>
                  startTransition(async () => {
                    await transferMaster(taskId, formData);
                    afterMutation();
                  })
                }
                className="flex items-center gap-2"
              >
                <select
                  name="userId"
                  aria-label="master 위임 대상"
                  className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
                >
                  {task.participants.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.user.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline" disabled={isPending}>
                  위임
                </Button>
              </form>
            </section>
          )}

          <section className="space-y-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
            <h3 className="text-xs font-semibold tracking-wide text-destructive uppercase">위험 작업 · 업무 삭제</h3>
            <DeleteForm taskId={taskId} onDeleted={onDeleted} />
          </section>
        </>
      )}

      <div className="flex items-center gap-2 pt-2">
        <p className="text-[11px] font-bold tracking-wider text-muted-foreground/70 uppercase">협업</p>
        <div className="h-px flex-1 bg-foreground/10" />
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">관련 링크 ({task.links.length})</h3>
        <ul className="space-y-1">
          {task.links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 p-2 text-sm">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate underline underline-offset-2"
              >
                {l.label || l.url}
              </a>
              {canManage && (
                <button
                  type="button"
                  aria-label="링크 삭제"
                  onClick={() => deleteTaskLink(l.id).then(afterMutation)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
        {canComment && <TaskLinkForm taskId={taskId} onDone={afterMutation} />}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">코멘트 ({task.comments.length})</h3>
        <ul className="space-y-2">
          {task.comments.map((c) => (
            <li key={c.id} className="rounded-md bg-muted/50 p-2 text-sm">
              <p className="text-xs text-muted-foreground">{c.author.name}</p>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
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
    </div>
  );
}

function ExtendDueDateForm({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const action = extendDueDate.bind(null, taskId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone();
      }}
      className="flex items-center gap-2"
    >
      <Input name="dueDate" type="date" className="w-auto" />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        연장
      </Button>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </form>
  );
}

function EditInfoForm({
  taskId,
  title,
  memo,
  tags,
  onDone,
}: {
  taskId: string;
  title: string;
  memo: string;
  tags: string[];
  onDone: () => void;
}) {
  const action = updateTaskInfo.bind(null, taskId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone();
      }}
      className="space-y-2"
    >
      <Input name="title" defaultValue={title} required />
      <Textarea name="memo" defaultValue={memo} placeholder="메모" rows={3} />
      <Input name="tags" defaultValue={tags.join(", ")} placeholder="태그 (쉼표로 구분)" />
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        저장
      </Button>
    </form>
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
  const action = inviteToTask.bind(null, taskId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const [grants, setGrants] = useState<{ taskId: string; includeSubtree: boolean }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <form
      action={async (formData) => {
        formData.set("grants", JSON.stringify(grants));
        selected.forEach((userId) => formData.append("userIds", userId));
        await formAction(formData);
        onDone();
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

function DeriveDialog({ parentTaskId, onDone }: { parentTaskId: string; onDone: () => void }) {
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
      <DialogTrigger render={<Button size="sm" variant="outline">파생하기</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>하위 업무 파생</DialogTitle>
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
            <Label htmlFor="derive-dueDate">기한</Label>
            <Input id="derive-dueDate" name="dueDate" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="derive-tags">태그 (쉼표로 구분)</Label>
            <Input id="derive-tags" name="tags" placeholder="예: 프론트엔드, 급함" />
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
            {isPending ? "생성 중..." : "파생하기"}
          </Button>
        </form>
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

function TaskLinkForm({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const action = addTaskLink.bind(null, taskId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
        onDone();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <Input name="url" placeholder="https://..." className="h-auto w-40 py-1.5 text-sm" required />
      <Input name="label" placeholder="이름(선택)" className="h-auto w-28 py-1.5 text-sm" />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        추가
      </Button>
      {errorMessage && <p className="w-full text-sm text-destructive">{errorMessage}</p>}
    </form>
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
  const action = addComment.bind(null, taskId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const [notify, setNotify] = useState<string[]>([]);

  return (
    <form
      action={async (formData) => {
        notify.forEach((userId) => formData.append("notify", userId));
        await formAction(formData);
        setNotify([]);
        onDone();
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
