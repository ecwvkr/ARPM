"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/permissions";
import { getTaskAccess } from "@/lib/tasks";

export async function getTaskDetail(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
}

export async function createTask(
  projectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { canView } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!canView) return "프로젝트에 접근할 수 없습니다.";

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";

  const memo = (formData.get("memo") as string | null)?.trim() || null;
  const dueDateRaw = formData.get("dueDate") as string | null;
  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";

  await prisma.task.create({
    data: {
      projectId,
      title,
      memo,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      visibility,
      masterId: session.user.id,
    },
  });

  revalidatePath(`/projects/${projectId}`);
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

  revalidatePath(`/projects/${task.projectId}`);
}

export async function leaveTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canLeave } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canLeave) throw new Error("이탈할 수 없습니다.");

  await prisma.taskParticipant.delete({
    where: { taskId_userId: { taskId, userId: session.user.id } },
  });

  revalidatePath(`/projects/${task.projectId}`);
}

export async function updateTaskStatus(taskId: string, status: "TODO" | "IN_PROGRESS") {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canParticipantAct } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canParticipantAct) throw new Error("권한이 없습니다.");
  if (task.completedAt) throw new Error("완료된 업무는 상태를 변경할 수 없습니다.");

  await prisma.task.update({ where: { id: taskId }, data: { status } });
  revalidatePath(`/projects/${task.projectId}`);
}

export async function completeTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canParticipantAct } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canParticipantAct) throw new Error("권한이 없습니다.");

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt: new Date() },
  });

  revalidatePath(`/projects/${task.projectId}`);
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
  revalidatePath(`/projects/${task.projectId}`);
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

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";
  const memo = (formData.get("memo") as string | null)?.trim() || null;

  await prisma.task.update({ where: { id: taskId }, data: { title, memo } });
  revalidatePath(`/projects/${task.projectId}`);
}

export async function updateTaskVisibility(taskId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) throw new Error("master만 변경할 수 있습니다.");

  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  await prisma.task.update({ where: { id: taskId }, data: { visibility } });
  revalidatePath(`/projects/${task.projectId}`);
}

export async function transferMaster(taskId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { task, canManage } = await getTaskAccess(taskId, session.user.id, !!session.user.isSuperAdmin);
  if (!task || !canManage) throw new Error("master만 위임할 수 있습니다.");

  const newMasterId = formData.get("userId") as string | null;
  if (!newMasterId) throw new Error("대상을 선택하세요.");

  const isEligible = task.participants.some((p) => p.userId === newMasterId);
  if (!isEligible) throw new Error("참여자에게만 위임할 수 있습니다.");

  await prisma.task.update({ where: { id: taskId }, data: { masterId: newMasterId } });
  revalidatePath(`/projects/${task.projectId}`);
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

  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return "이메일을 입력하세요.";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return "해당 이메일의 유저를 찾을 수 없습니다.";

  const includeSubtree = formData.get("includeSubtree") === "true";

  await prisma.taskParticipant.upsert({
    where: { taskId_userId: { taskId, userId: user.id } },
    update: { includeSubtree },
    create: { taskId, userId: user.id, includeSubtree },
  });

  revalidatePath(`/projects/${task.projectId}`);
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
  revalidatePath(`/projects/${task.projectId}`);
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
  ]);

  revalidatePath(`/projects/${task.projectId}`);
}
