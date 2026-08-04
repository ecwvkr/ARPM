"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  deleteTask,
} from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

type Detail = Awaited<ReturnType<typeof getTaskDetail>>;

const STATUS_LABEL: Record<string, string> = {
  TODO: "진행전",
  IN_PROGRESS: "진행중",
  DONE: "종료",
};

export function TaskDetail({ taskId, onDeleted }: { taskId: string; onDeleted: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const reload = () => {
    startTransition(async () => {
      setDetail(await getTaskDetail(taskId));
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const afterMutation = () => {
    reload();
    router.refresh();
  };

  if (!detail || !detail.task) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">불러오는 중...</p>;
  }

  const { task, canManage, canParticipantAct, canComment, canJoin, canLeave } = detail;
  const overdue = !!task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";
  const locked = task.completedAt !== null;

  return (
    <div className="space-y-6 px-1 pb-8">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-medium">{task.title}</h2>
          <Badge variant={task.status === "DONE" ? "secondary" : "default"}>
            {STATUS_LABEL[task.status]}
          </Badge>
          {overdue && <Badge variant="destructive">지연</Badge>}
          <Badge variant={task.visibility === "PUBLIC" ? "secondary" : "outline"}>
            {task.visibility === "PUBLIC" ? "공개" : "비공개"}
          </Badge>
        </div>
        {task.memo && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.memo}</p>}
        <p className="text-xs text-muted-foreground">master: {task.master.name}</p>
      </section>

      {canParticipantAct && !locked && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">상태</h3>
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
          <h3 className="text-sm font-medium">기한 연장</h3>
          <ExtendDueDateForm taskId={taskId} onDone={afterMutation} />
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
        <h3 className="text-sm font-medium">참여자 ({task.participants.length})</h3>
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
          <section className="space-y-2">
            <h3 className="text-sm font-medium">업무 정보 수정</h3>
            <EditInfoForm taskId={taskId} title={task.title} memo={task.memo ?? ""} onDone={afterMutation} />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">공개 범위</h3>
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
            <h3 className="text-sm font-medium">참여자 초대 (공유 범위 지정)</h3>
            <InviteForm taskId={taskId} taskTitle={task.title} onDone={afterMutation} />
          </section>

          {task.participants.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">master 위임</h3>
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

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-destructive">업무 삭제</h3>
            <DeleteForm taskId={taskId} onDeleted={onDeleted} />
          </section>
        </>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">코멘트 ({task.comments.length})</h3>
        <ul className="space-y-2">
          {task.comments.map((c) => (
            <li key={c.id} className="rounded-md border-[0.5px] p-2 text-sm">
              <p className="text-xs text-muted-foreground">{c.author.name}</p>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
        {canComment && <CommentForm taskId={taskId} onDone={afterMutation} />}
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
  onDone,
}: {
  taskId: string;
  title: string;
  memo: string;
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
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        저장
      </Button>
    </form>
  );
}

function InviteForm({
  taskId,
  taskTitle,
  onDone,
}: {
  taskId: string;
  taskTitle: string;
  onDone: () => void;
}) {
  const action = inviteToTask.bind(null, taskId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const [includeSubtree, setIncludeSubtree] = useState(true);

  return (
    <form
      action={async (formData) => {
        formData.set("includeSubtree", String(includeSubtree));
        await formAction(formData);
        onDone();
      }}
      className="space-y-2"
    >
      <Input name="email" type="email" placeholder="이메일로 초대" required />
      <div className="flex items-center gap-2 rounded-md border-[0.5px] p-2 text-sm">
        <Checkbox
          checked={includeSubtree}
          onCheckedChange={(v) => setIncludeSubtree(v === true)}
        />
        <span>
          {taskTitle}
          <span className="ml-1 text-xs text-muted-foreground">
            {includeSubtree ? "(하위 포함)" : "(해당 업무만)"}
          </span>
        </span>
      </div>
      <div className="flex gap-2 text-xs">
        <button type="button" className="underline underline-offset-2" onClick={() => setIncludeSubtree(true)}>
          전체 공유
        </button>
        <button type="button" className="underline underline-offset-2" onClick={() => setIncludeSubtree(false)}>
          이 업무만
        </button>
      </div>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        초대
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

function CommentForm({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const action = addComment.bind(null, taskId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone();
      }}
      className="space-y-2"
    >
      <Textarea name="body" placeholder="코멘트를 입력하세요" rows={2} required />
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        등록
      </Button>
    </form>
  );
}
