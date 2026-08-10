"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/permissions";
import { revalidateTaskViews } from "@/lib/revalidate";
import { getCommentVisibleCount } from "@/lib/settings";
import {
  getTaskAccess,
  listTasksForProject,
  buildSubtree,
  collectSubtreeIds,
  collectDescendantIds,
} from "@/lib/tasks";

export async function getTaskDetail(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const access = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  const commentVisibleCount = await getCommentVisibleCount();

  if (access.task) {
    await prisma.taskRead.upsert({
      where: { taskId_userId: { taskId, userId: session.user.id } },
      update: {},
      create: { taskId, userId: session.user.id },
    });
    revalidateTaskViews(access.task.projectId);
  }

  return {
    ...access,
    currentUserId: session.user.id,
    isSuperAdmin: !!session.user.isSuperAdmin,
    commentVisibleCount,
  };
}

export async function listTaskOptionsForProject(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { canView } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!canView) return [];

  const tasks = await listTasksForProject(projectId, session.user.id, !!session.user.isSuperAdmin);
  return tasks.map((t) => ({ id: t.id, title: t.title }));
}

export async function createTask(
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projectId = formData.get("projectId") as string | null;
  if (!projectId) return "프로젝트를 선택하세요.";

  const { canView } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!canView) return "프로젝트에 접근할 수 없습니다.";

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";

  const memo = (formData.get("memo") as string | null)?.trim() || null;
  const dueDateRaw = formData.get("dueDate") as string | null;
  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const recurrence = formData.get("recurrence") === "WEEKLY" ? "WEEKLY" : null;

  const parentIdRaw = formData.get("parentId") as string | null;
  let parentId: string | null = null;
  if (parentIdRaw) {
    const parent = await prisma.task.findUnique({ where: { id: parentIdRaw }, select: { projectId: true } });
    if (!parent || parent.projectId !== projectId) return "잘못된 연계 업무입니다.";
    parentId = parentIdRaw;
  }

  const participantIds = Array.from(
    new Set([
      session.user.id,
      ...formData.getAll("userIds").filter((v): v is string => typeof v === "string"),
    ]),
  );

  await prisma.task.create({
    data: {
      projectId,
      parentId,
      title,
      memo,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      visibility,
      masterId: session.user.id,
      recurrence,
      participants: { create: participantIds.map((userId) => ({ userId })) },
    },
  });

  revalidateTaskViews(projectId);
}

export async function deriveTask(
  parentTaskId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task: parent, canView } = await getTaskAccess(parentTaskId, session.user.id, !!session.user.isSuperAdmin);
  if (!parent || !canView) return "접근할 수 없습니다.";

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";

  const memo = (formData.get("memo") as string | null)?.trim() || null;
  const dueDateRaw = formData.get("dueDate") as string | null;
  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";

  await prisma.task.create({
    data: {
      projectId: parent.projectId,
      parentId: parent.id,
      title,
      memo,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      visibility,
      masterId: session.user.id,
      participants: { create: { userId: session.user.id } },
    },
  });

  if (parent.masterId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: parent.masterId,
        type: "SUBTASK_CREATED",
        refId: parent.id,
        message: `"${parent.title}"에 새 하위 업무 "${title}"가 생성되었습니다.`,
      },
    });
  }

  revalidateTaskViews(parent.projectId);
}

export async function duplicateTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canView } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canView) throw new Error("접근할 수 없습니다.");

  await prisma.task.create({
    data: {
      projectId: task.projectId,
      parentId: task.parentId,
      title: `${task.title} 복사본`,
      memo: task.memo,
      dueDate: task.dueDate,
      visibility: task.visibility,
      masterId: session.user.id,
      participants: { create: { userId: session.user.id } },
    },
  });

  revalidateTaskViews(task.projectId);
}

export async function moveTask(taskId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) throw new Error("master만 이동할 수 있습니다.");

  const newParentIdRaw = formData.get("parentId") as string | null;
  const newParentId = newParentIdRaw && newParentIdRaw !== "" ? newParentIdRaw : null;

  if (newParentId) {
    if (newParentId === taskId) throw new Error("자기 자신을 부모로 지정할 수 없습니다.");

    const projectTasks = await listTasksForProject(task.projectId, session.user.id, !!session.user.isSuperAdmin);
    const target = projectTasks.find((t) => t.id === newParentId);
    if (!target) throw new Error("같은 프로젝트 내에서만 이동할 수 있습니다.");

    const descendants = collectDescendantIds(projectTasks, taskId);
    if (descendants.has(newParentId)) throw new Error("하위 업무를 부모로 지정할 수 없습니다.");
  }

  await prisma.task.update({ where: { id: taskId }, data: { parentId: newParentId } });
  revalidateTaskViews(task.projectId);
}

export async function listMovableTargets(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) return [];

  const projectTasks = await listTasksForProject(task.projectId, session.user.id, !!session.user.isSuperAdmin);
  const descendants = collectDescendantIds(projectTasks, taskId);

  return projectTasks
    .filter((t) => t.id !== taskId && !descendants.has(t.id))
    .map((t) => ({ id: t.id, title: t.title }));
}

export async function getTaskSubtree(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) return null;

  const projectTasks = await listTasksForProject(task.projectId, session.user.id, !!session.user.isSuperAdmin);
  return buildSubtree(projectTasks, taskId);
}

export async function getCanvasTasks(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { canView } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!canView) return [];

  const tasks = await listTasksForProject(projectId, session.user.id, !!session.user.isSuperAdmin);
  return tasks.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    title: t.title,
    status: t.status,
    visibility: t.visibility,
    dueDate: t.dueDate,
    canvasX: t.canvasX,
    canvasY: t.canvasY,
  }));
}

export async function updateTaskPosition(taskId: string, x: number, y: number) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) return;

  await prisma.task.update({ where: { id: taskId }, data: { canvasX: x, canvasY: y } });
}

export async function joinTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canJoin } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canJoin) throw new Error("참여할 수 없습니다.");

  await prisma.taskParticipant.upsert({
    where: { taskId_userId: { taskId, userId: session.user.id } },
    update: {},
    create: { taskId, userId: session.user.id },
  });

  revalidateTaskViews(task.projectId);
}

export async function leaveTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canLeave } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canLeave) throw new Error("이탈할 수 없습니다.");

  await prisma.taskParticipant.delete({
    where: { taskId_userId: { taskId, userId: session.user.id } },
  });

  revalidateTaskViews(task.projectId);
}

export async function removeParticipant(taskId: string, userId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) throw new Error("master만 참여자를 제외할 수 있습니다.");
  if (userId === task.masterId) throw new Error("master는 위임을 통해서만 변경할 수 있습니다.");

  await prisma.taskParticipant.deleteMany({ where: { taskId, userId } });
  revalidateTaskViews(task.projectId);
}

export async function updateTaskStatus(taskId: string, status: "TODO" | "IN_PROGRESS") {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canParticipantAct } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canParticipantAct) throw new Error("권한이 없습니다.");
  if (task.completedAt) throw new Error("완료된 업무는 상태를 변경할 수 없습니다.");

  await prisma.task.update({ where: { id: taskId }, data: { status } });
  revalidateTaskViews(task.projectId);
}

export async function completeTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canParticipantAct } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canParticipantAct) throw new Error("권한이 없습니다.");
  if (task.completedAt) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt: new Date() },
  });

  if (task.recurrence === "WEEKLY") {
    const base = task.dueDate ?? new Date();
    const nextDueDate = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    await prisma.task.create({
      data: {
        projectId: task.projectId,
        title: task.title,
        memo: task.memo,
        dueDate: nextDueDate,
        visibility: task.visibility,
        masterId: task.masterId,
        recurrence: "WEEKLY",
        participants: { create: { userId: task.masterId } },
      },
    });
  }

  revalidateTaskViews(task.projectId);
}

export async function reopenTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task) throw new Error("업무를 찾을 수 없습니다.");
  if (!canManage && !session.user.isSuperAdmin) throw new Error("master 또는 총관리자만 완료를 취소할 수 있습니다.");
  if (!task.completedAt) return;

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { status: "IN_PROGRESS", completedAt: null },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "REOPEN_TASK",
        targetType: "TASK",
        targetId: task.id,
        projectId: task.projectId,
        message: `"${task.title}" 업무 완료를 취소함`,
      },
    }),
  ]);

  revalidateTaskViews(task.projectId);
}

export async function setMyPriority(taskId: string, level: "URGENT" | "NORMAL" | "HOLD") {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canParticipantAct } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canParticipantAct) throw new Error("권한이 없습니다.");

  await prisma.taskPriority.upsert({
    where: { taskId_userId: { taskId, userId: session.user.id } },
    update: { level },
    create: { taskId, userId: session.user.id, level },
  });

  revalidateTaskViews(task.projectId);
}

export async function extendDueDate(
  taskId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canParticipantAct } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canParticipantAct) return "권한이 없습니다.";

  const dueDateRaw = formData.get("dueDate") as string | null;
  if (!dueDateRaw) return "날짜를 입력하세요.";

  await prisma.task.update({ where: { id: taskId }, data: { dueDate: new Date(dueDateRaw) } });
  revalidateTaskViews(task.projectId);
}

export async function updateTaskInfo(
  taskId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) return "master만 수정할 수 있습니다.";
  if (task.completedAt) return "완료된 업무는 수정할 수 없습니다.";

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";
  const memo = (formData.get("memo") as string | null)?.trim() || null;

  await prisma.task.update({
    where: { id: taskId },
    data: { title, memo },
  });
  revalidateTaskViews(task.projectId);
}

export async function updateTaskVisibility(taskId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) throw new Error("master만 변경할 수 있습니다.");

  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  await prisma.task.update({ where: { id: taskId }, data: { visibility } });
  revalidateTaskViews(task.projectId);
}

export async function transferMaster(taskId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) throw new Error("master만 위임할 수 있습니다.");

  const newMasterId = formData.get("userId") as string | null;
  if (!newMasterId) throw new Error("대상을 선택하세요.");

  // 위임 대상은 원칙적으로 참여자여야 하지만, 미참여자를 선택하면 참여자로 자동 추가한다.
  const existingParticipant = task.participants.find((p) => p.userId === newMasterId);
  const newMasterUser =
    existingParticipant?.user ??
    (await prisma.user.findUnique({ where: { id: newMasterId }, select: { id: true, name: true } }));
  if (!newMasterUser) throw new Error("존재하지 않는 사용자입니다.");

  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { masterId: newMasterId } }),
    prisma.taskParticipant.upsert({
      where: { taskId_userId: { taskId, userId: newMasterId } },
      update: {},
      create: { taskId, userId: newMasterId },
    }),
    prisma.notification.create({
      data: {
        userId: newMasterId,
        type: "MASTER_DELEGATED",
        refId: task.id,
        message: `"${task.title}" 업무의 master로 위임되었습니다.`,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "TRANSFER_MASTER",
        targetType: "TASK",
        targetId: task.id,
        projectId: task.projectId,
        message: `"${task.title}" 업무의 master를 ${newMasterUser.name}님에게 위임`,
      },
    }),
  ]);
  revalidateTaskViews(task.projectId);
}

export async function inviteToTask(
  taskId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) return "master만 초대할 수 있습니다.";

  const userIds = formData.getAll("userIds").filter((v): v is string => typeof v === "string");
  if (userIds.length === 0) return "초대할 계정을 선택하세요.";

  const grantsRaw = formData.get("grants") as string | null;
  let grants: { taskId: string; includeSubtree: boolean }[];
  try {
    grants = grantsRaw ? JSON.parse(grantsRaw) : [{ taskId, includeSubtree: true }];
  } catch {
    return "잘못된 요청입니다.";
  }
  if (!Array.isArray(grants) || grants.length === 0) return "공유할 업무를 선택하세요.";

  const projectTasks = await listTasksForProject(task.projectId, session.user.id, !!session.user.isSuperAdmin);
  const subtree = buildSubtree(projectTasks, taskId);
  const validIds = subtree ? collectSubtreeIds(subtree) : new Set([taskId]);

  for (const g of grants) {
    if (!validIds.has(g.taskId)) return "잘못된 요청입니다.";
  }

  await prisma.$transaction(
    userIds.flatMap((userId) => [
      ...grants.map((g) =>
        prisma.taskParticipant.upsert({
          where: { taskId_userId: { taskId: g.taskId, userId } },
          update: { includeSubtree: g.includeSubtree },
          create: { taskId: g.taskId, userId, includeSubtree: g.includeSubtree },
        }),
      ),
      prisma.notification.create({
        data: {
          userId,
          type: "TASK_INVITED",
          refId: task.id,
          message: `"${task.title}" 업무에 초대되었습니다.`,
        },
      }),
    ]),
  );

  revalidateTaskViews(task.projectId);
}

export async function addComment(
  taskId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canComment } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canComment) return "권한이 없습니다.";

  const body = (formData.get("body") as string | null)?.trim();
  if (!body) return "내용을 입력하세요.";

  await prisma.comment.create({ data: { taskId, authorId: session.user.id, body } });

  const notifyUserIds = formData.getAll("notify").filter((v): v is string => typeof v === "string" && v !== session.user.id);
  if (notifyUserIds.length > 0) {
    const snippet = body.length > 40 ? `${body.slice(0, 40)}...` : body;
    await prisma.notification.createMany({
      data: notifyUserIds.map((userId) => ({
        userId,
        type: "COMMENT_MENTION",
        refId: taskId,
        message: `${session.user.name}님이 "${task.title}" 업무 코멘트에서 회원님을 언급했습니다: "${snippet}"`,
      })),
    });
  }

  revalidateTaskViews(task.projectId);
}

export async function updateComment(
  commentId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { task: true } });
  if (!comment) return "존재하지 않는 코멘트입니다.";
  if (comment.authorId !== session.user.id && !session.user.isSuperAdmin) return "수정 권한이 없습니다.";

  const body = (formData.get("body") as string | null)?.trim();
  if (!body) return "내용을 입력하세요.";

  await prisma.comment.update({ where: { id: commentId }, data: { body } });
  revalidateTaskViews(comment.task.projectId);
}

export async function deleteComment(commentId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { task: true } });
  if (!comment) return;
  if (comment.authorId !== session.user.id && !session.user.isSuperAdmin) return;

  await prisma.comment.delete({ where: { id: commentId } });
  revalidateTaskViews(comment.task.projectId);
}

export async function deleteTask(
  taskId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) return "master만 삭제할 수 있습니다.";

  const confirmText = formData.get("confirm") as string | null;
  if (confirmText !== "삭제") return "'삭제'를 정확히 입력하세요.";

  const admins = await prisma.user.findMany({
    where: { isSuperAdmin: true },
    select: { id: true },
  });

  const notifyUserIds = Array.from(
    new Set([task.masterId, ...task.participants.map((p) => p.userId), ...admins.map((a) => a.id)]),
  );

  await prisma.$transaction([
    prisma.task.updateMany({ where: { parentId: taskId }, data: { parentId: task.parentId } }),
    prisma.task.delete({ where: { id: taskId } }),
    prisma.notification.createMany({
      data: notifyUserIds.map((userId) => ({
        userId,
        type: "TASK_DELETED",
        refId: task.projectId,
        message: `"${task.title}" 업무가 삭제되었습니다.`,
      })),
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DELETE_TASK",
        targetType: "TASK",
        targetId: task.id,
        projectId: task.projectId,
        message: `"${task.title}" 업무를 영구 삭제`,
      },
    }),
  ]);

  revalidateTaskViews(task.projectId);
}
