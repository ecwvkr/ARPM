"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPartnerAccess } from "@/lib/permissions";
import { revalidateProjectViews } from "@/lib/revalidate";
import { getCommentVisibleCount } from "@/lib/settings";
import { normalizeLinks } from "@/lib/normalize";
import { listVisiblePartners } from "@/lib/partners";
import {
  getProjectAccess,
  listProjectsForPartner,
  listCanvasProjectsForPartner,
  listCanvasProjectsForPartners,
  buildSubtree,
  collectSubtreeIds,
  collectDescendantIds,
} from "@/lib/projects";

export async function getProjectDetail(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const access = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  const commentVisibleCount = await getCommentVisibleCount();

  if (access.project) {
    await prisma.projectRead.upsert({
      where: { projectId_userId: { projectId, userId: session.user.id } },
      update: {},
      create: { projectId, userId: session.user.id },
    });
    await revalidateProjectViews(access.project.partnerId, { touch: false });
  }

  return {
    ...access,
    currentUserId: session.user.id,
    isSuperAdmin: !!session.user.isSuperAdmin,
    commentVisibleCount,
  };
}

export async function listProjectOptionsForPartner(partnerId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { canView } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canView) return [];

  const projects = await listProjectsForPartner(partnerId, session.user.id, !!session.user.isSuperAdmin);
  return projects.map((t) => ({ id: t.id, title: t.title }));
}

export async function createProject(
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const partnerId = formData.get("partnerId") as string | null;
  if (!partnerId) return "파트너를 선택하세요.";

  const { canView } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canView) return "파트너에 접근할 수 없습니다.";

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";

  const memo = (formData.get("memo") as string | null)?.trim() || null;
  const links = normalizeLinks(formData.getAll("link"));
  if (links === undefined) return "올바른 링크를 입력하세요. (예: https://example.com)";
  const dueDateRaw = formData.get("dueDate") as string | null;
  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const recurrence = formData.get("recurrence") === "WEEKLY" ? "WEEKLY" : null;

  const parentIdRaw = formData.get("parentId") as string | null;
  let parentId: string | null = null;
  if (parentIdRaw) {
    const parent = await prisma.project.findUnique({ where: { id: parentIdRaw }, select: { partnerId: true } });
    if (!parent || parent.partnerId !== partnerId) return "잘못된 상위 프로젝트입니다.";
    parentId = parentIdRaw;
  }

  const participantIds = Array.from(
    new Set([
      session.user.id,
      ...formData.getAll("userIds").filter((v): v is string => typeof v === "string"),
    ]),
  );

  await prisma.project.create({
    data: {
      partnerId,
      parentId,
      title,
      memo,
      links,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      visibility,
      masterId: session.user.id,
      recurrence,
      participants: { create: participantIds.map((userId) => ({ userId })) },
    },
  });

  await revalidateProjectViews(partnerId);
}

export async function deriveProject(
  parentProjectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project: parent, canView } = await getProjectAccess(parentProjectId, session.user.id, !!session.user.isSuperAdmin);
  if (!parent || !canView) return "접근할 수 없습니다.";

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";

  const memo = (formData.get("memo") as string | null)?.trim() || null;
  const links = normalizeLinks(formData.getAll("link"));
  if (links === undefined) return "올바른 링크를 입력하세요. (예: https://example.com)";
  const dueDateRaw = formData.get("dueDate") as string | null;
  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";

  await prisma.project.create({
    data: {
      partnerId: parent.partnerId,
      parentId: parent.id,
      title,
      memo,
      links,
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
        message: `"${parent.title}"에 새 하위 프로젝트 "${title}"가 생성되었습니다.`,
      },
    });
  }

  await revalidateProjectViews(parent.partnerId);
}

export async function duplicateProject(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canView } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canView) throw new Error("접근할 수 없습니다.");

  await prisma.project.create({
    data: {
      partnerId: project.partnerId,
      parentId: project.parentId,
      title: `${project.title} 복사본`,
      memo: project.memo,
      links: project.links,
      dueDate: project.dueDate,
      visibility: project.visibility,
      masterId: session.user.id,
      participants: { create: { userId: session.user.id } },
    },
  });

  await revalidateProjectViews(project.partnerId);
}

export async function moveProject(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) throw new Error("master만 이동할 수 있습니다.");

  const newParentIdRaw = formData.get("parentId") as string | null;
  const newParentId = newParentIdRaw && newParentIdRaw !== "" ? newParentIdRaw : null;

  if (newParentId) {
    if (newParentId === projectId) throw new Error("자기 자신을 부모로 지정할 수 없습니다.");

    const partnerProjects = await listProjectsForPartner(project.partnerId, session.user.id, !!session.user.isSuperAdmin);
    const target = partnerProjects.find((t) => t.id === newParentId);
    if (!target) throw new Error("같은 파트너 내에서만 이동할 수 있습니다.");

    const descendants = collectDescendantIds(partnerProjects, projectId);
    if (descendants.has(newParentId)) throw new Error("하위 프로젝트를 부모로 지정할 수 없습니다.");
  }

  await prisma.project.update({ where: { id: projectId }, data: { parentId: newParentId } });
  await revalidateProjectViews(project.partnerId);
}

export async function listMovableTargets(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) return [];

  const partnerProjects = await listProjectsForPartner(project.partnerId, session.user.id, !!session.user.isSuperAdmin);
  const descendants = collectDescendantIds(partnerProjects, projectId);

  return partnerProjects
    .filter((t) => t.id !== projectId && !descendants.has(t.id))
    .map((t) => ({ id: t.id, title: t.title }));
}

export async function getProjectSubtree(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) return null;

  const partnerProjects = await listProjectsForPartner(project.partnerId, session.user.id, !!session.user.isSuperAdmin);
  return buildSubtree(partnerProjects, projectId);
}

export async function getCanvasProjects(partnerId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { canView } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canView) return [];

  const projects = await listCanvasProjectsForPartner(partnerId, session.user.id, !!session.user.isSuperAdmin);
  return projects.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    title: t.title,
    status: t.status,
    visibility: t.visibility,
    dueDate: t.dueDate,
    canvasX: t.canvasX,
    canvasY: t.canvasY,
    partnerId: t.partnerId,
  }));
}

// 전체 뷰: 볼 수 있는 모든 파트너의 프로젝트를 한 캔버스에 올린다. 저장된 좌표는
// 파트너별 캔버스 기준이라 여기서 쓰면 서로 겹치므로, 전체 뷰는 자동 배치만 쓴다.
export async function getAllCanvasProjects() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isSuperAdmin = !!session.user.isSuperAdmin;
  const partners = await listVisiblePartners(session.user.id, isSuperAdmin, false);
  const projects = await listCanvasProjectsForPartners(
    partners.map((p) => p.id),
    session.user.id,
    isSuperAdmin,
  );

  return {
    partners: partners.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    projects: projects.map((t) => ({
      id: t.id,
      parentId: t.parentId,
      title: t.title,
      status: t.status,
      visibility: t.visibility,
      dueDate: t.dueDate,
      canvasX: null,
      canvasY: null,
      partnerId: t.partnerId,
    })),
  };
}

export async function updateProjectPosition(projectId: string, x: number, y: number) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) return;

  await prisma.project.update({ where: { id: projectId }, data: { canvasX: x, canvasY: y } });
}

export async function joinProject(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canJoin } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canJoin) throw new Error("참여할 수 없습니다.");

  await prisma.projectParticipant.upsert({
    where: { projectId_userId: { projectId, userId: session.user.id } },
    update: {},
    create: { projectId, userId: session.user.id },
  });

  await revalidateProjectViews(project.partnerId);
}

export async function leaveProject(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canLeave } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canLeave) throw new Error("이탈할 수 없습니다.");

  await prisma.projectParticipant.delete({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });

  await revalidateProjectViews(project.partnerId);
}

export async function removeParticipant(projectId: string, userId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) throw new Error("master만 참여자를 제외할 수 있습니다.");
  if (userId === project.masterId) throw new Error("master는 위임을 통해서만 변경할 수 있습니다.");

  await prisma.projectParticipant.deleteMany({ where: { projectId, userId } });
  await revalidateProjectViews(project.partnerId);
}

export async function updateProjectStatus(projectId: string, status: "TODO" | "IN_PROGRESS") {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canParticipantAct } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canParticipantAct) throw new Error("권한이 없습니다.");
  if (project.completedAt) throw new Error("완료된 프로젝트는 상태를 변경할 수 없습니다.");

  await prisma.project.update({ where: { id: projectId }, data: { status } });
  await revalidateProjectViews(project.partnerId);
}

export async function completeProject(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canParticipantAct } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canParticipantAct) throw new Error("권한이 없습니다.");
  if (project.completedAt) return;

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "DONE", completedAt: new Date() },
  });

  if (project.recurrence === "WEEKLY") {
    const base = project.dueDate ?? new Date();
    const nextDueDate = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    await prisma.project.create({
      data: {
        partnerId: project.partnerId,
        title: project.title,
        memo: project.memo,
        links: project.links,
        dueDate: nextDueDate,
        visibility: project.visibility,
        masterId: project.masterId,
        recurrence: "WEEKLY",
        participants: { create: { userId: project.masterId } },
      },
    });
  }

  await revalidateProjectViews(project.partnerId);
}

export async function reopenProject(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
  if (!canManage && !session.user.isSuperAdmin) throw new Error("master 또는 총관리자만 완료를 취소할 수 있습니다.");
  if (!project.completedAt) return;

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { status: "IN_PROGRESS", completedAt: null },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "REOPEN_PROJECT",
        targetType: "PROJECT",
        targetId: project.id,
        partnerId: project.partnerId,
        message: `"${project.title}" 프로젝트 완료를 취소함`,
      },
    }),
  ]);

  await revalidateProjectViews(project.partnerId);
}

export async function setMyPriority(projectId: string, level: "URGENT" | "NORMAL" | "HOLD") {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canParticipantAct } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canParticipantAct) throw new Error("권한이 없습니다.");

  await prisma.projectPriority.upsert({
    where: { projectId_userId: { projectId, userId: session.user.id } },
    update: { level },
    create: { projectId, userId: session.user.id, level },
  });

  await revalidateProjectViews(project.partnerId);
}

export async function extendDueDate(
  projectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canParticipantAct } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canParticipantAct) return "권한이 없습니다.";

  const dueDateRaw = formData.get("dueDate") as string | null;
  if (!dueDateRaw) return "날짜를 입력하세요.";

  await prisma.project.update({ where: { id: projectId }, data: { dueDate: new Date(dueDateRaw) } });
  await revalidateProjectViews(project.partnerId);
}

export async function updateProjectInfo(
  projectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) return "master만 수정할 수 있습니다.";
  if (project.completedAt) return "완료된 프로젝트는 수정할 수 없습니다.";

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";
  const memo = (formData.get("memo") as string | null)?.trim() || null;
  const links = normalizeLinks(formData.getAll("link"));
  if (links === undefined) return "올바른 링크를 입력하세요. (예: https://example.com)";

  await prisma.project.update({
    where: { id: projectId },
    data: { title, memo, links },
  });
  await revalidateProjectViews(project.partnerId);
}

export async function updateProjectVisibility(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) throw new Error("master만 변경할 수 있습니다.");

  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  await prisma.project.update({ where: { id: projectId }, data: { visibility } });
  await revalidateProjectViews(project.partnerId);
}

export async function transferMaster(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) throw new Error("master만 위임할 수 있습니다.");

  const newMasterId = formData.get("userId") as string | null;
  if (!newMasterId) throw new Error("대상을 선택하세요.");

  // 위임 대상은 원칙적으로 참여자여야 하지만, 미참여자를 선택하면 참여자로 자동 추가한다.
  const existingParticipant = project.participants.find((p) => p.userId === newMasterId);
  const newMasterUser =
    existingParticipant?.user ??
    (await prisma.user.findUnique({ where: { id: newMasterId }, select: { id: true, name: true } }));
  if (!newMasterUser) throw new Error("존재하지 않는 사용자입니다.");

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { masterId: newMasterId } }),
    prisma.projectParticipant.upsert({
      where: { projectId_userId: { projectId, userId: newMasterId } },
      update: {},
      create: { projectId, userId: newMasterId },
    }),
    prisma.notification.create({
      data: {
        userId: newMasterId,
        type: "MASTER_DELEGATED",
        refId: project.id,
        message: `"${project.title}" 프로젝트의 master로 위임되었습니다.`,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "TRANSFER_MASTER",
        targetType: "PROJECT",
        targetId: project.id,
        partnerId: project.partnerId,
        message: `"${project.title}" 프로젝트의 master를 ${newMasterUser.name}님에게 위임`,
      },
    }),
  ]);
  await revalidateProjectViews(project.partnerId);
}

export async function inviteToProject(
  projectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) return "master만 초대할 수 있습니다.";

  const userIds = formData.getAll("userIds").filter((v): v is string => typeof v === "string");
  if (userIds.length === 0) return "초대할 계정을 선택하세요.";

  const grantsRaw = formData.get("grants") as string | null;
  let grants: { projectId: string; includeSubtree: boolean }[];
  try {
    grants = grantsRaw ? JSON.parse(grantsRaw) : [{ projectId, includeSubtree: true }];
  } catch {
    return "잘못된 요청입니다.";
  }
  if (!Array.isArray(grants) || grants.length === 0) return "공유할 프로젝트를 선택하세요.";

  // 읽기 전용(VIEWER)은 조회·코멘트만 가능하고 수정·삭제·이동은 할 수 없다(D4).
  const role = formData.get("role") === "VIEWER" ? "VIEWER" : "MEMBER";

  const partnerProjects = await listProjectsForPartner(project.partnerId, session.user.id, !!session.user.isSuperAdmin);
  const subtree = buildSubtree(partnerProjects, projectId);
  const validIds = subtree ? collectSubtreeIds(subtree) : new Set([projectId]);

  for (const g of grants) {
    if (!validIds.has(g.projectId)) return "잘못된 요청입니다.";
  }

  await prisma.$transaction(
    userIds.flatMap((userId) => [
      ...grants.map((g) =>
        prisma.projectParticipant.upsert({
          where: { projectId_userId: { projectId: g.projectId, userId } },
          update: { includeSubtree: g.includeSubtree, role },
          create: { projectId: g.projectId, userId, includeSubtree: g.includeSubtree, role },
        }),
      ),
      prisma.notification.create({
        data: {
          userId,
          type: "PROJECT_INVITED",
          refId: project.id,
          message: `"${project.title}" 프로젝트에 초대되었습니다.`,
        },
      }),
    ]),
  );

  await revalidateProjectViews(project.partnerId);
}

export async function addComment(
  projectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canComment } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canComment) return "권한이 없습니다.";

  const body = (formData.get("body") as string | null)?.trim();
  if (!body) return "내용을 입력하세요.";

  await prisma.comment.create({ data: { projectId, authorId: session.user.id, body } });

  const notifyUserIds = formData.getAll("notify").filter((v): v is string => typeof v === "string" && v !== session.user.id);
  if (notifyUserIds.length > 0) {
    const snippet = body.length > 40 ? `${body.slice(0, 40)}...` : body;
    await prisma.notification.createMany({
      data: notifyUserIds.map((userId) => ({
        userId,
        type: "COMMENT_MENTION",
        refId: projectId,
        message: `${session.user.name}님이 "${project.title}" 프로젝트 코멘트에서 회원님을 언급했습니다: "${snippet}"`,
      })),
    });
  }

  await revalidateProjectViews(project.partnerId);
}

export async function updateComment(
  commentId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { project: true } });
  if (!comment) return "존재하지 않는 코멘트입니다.";
  if (comment.authorId !== session.user.id && !session.user.isSuperAdmin) return "수정 권한이 없습니다.";

  const body = (formData.get("body") as string | null)?.trim();
  if (!body) return "내용을 입력하세요.";

  await prisma.comment.update({ where: { id: commentId }, data: { body } });
  await revalidateProjectViews(comment.project.partnerId);
}

export async function deleteComment(commentId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { project: true } });
  if (!comment) return;
  if (comment.authorId !== session.user.id && !session.user.isSuperAdmin) return;

  await prisma.comment.delete({ where: { id: commentId } });
  await revalidateProjectViews(comment.project.partnerId);
}

// 소프트 삭제(보관함으로 이동). 하위 트리를 함께 보관해야 나중에 복구했을 때 구조가
// 그대로 돌아온다(D3) — 부모만 보관하고 자식은 그대로 두면 트리가 끊긴다.
export async function archiveProject(
  projectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canManage } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!project || !canManage) return "master만 보관할 수 있습니다.";

  const confirmText = formData.get("confirm") as string | null;
  if (confirmText !== "삭제") return "'삭제'를 정확히 입력하세요.";

  const siblings = await prisma.project.findMany({
    where: { partnerId: project.partnerId, deletedAt: null },
    select: { id: true, parentId: true },
  });
  const subtreeIds = [projectId, ...collectDescendantIds(siblings, projectId)];

  const admins = await prisma.user.findMany({ where: { isSuperAdmin: true }, select: { id: true } });
  const notifyUserIds = Array.from(
    new Set([project.masterId, ...project.participants.map((p) => p.userId), ...admins.map((a) => a.id)]),
  );

  await prisma.$transaction([
    prisma.project.updateMany({ where: { id: { in: subtreeIds } }, data: { deletedAt: new Date() } }),
    prisma.notification.createMany({
      data: notifyUserIds.map((userId) => ({
        userId,
        type: "PROJECT_ARCHIVED",
        refId: project.partnerId,
        message: `"${project.title}" 프로젝트가 보관함으로 이동되었습니다.`,
      })),
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ARCHIVE_PROJECT",
        targetType: "PROJECT",
        targetId: project.id,
        partnerId: project.partnerId,
        message:
          subtreeIds.length > 1
            ? `"${project.title}" 프로젝트를 보관함으로 이동 (하위 ${subtreeIds.length - 1}건 포함)`
            : `"${project.title}" 프로젝트를 보관함으로 이동`,
      },
    }),
  ]);

  await revalidateProjectViews(project.partnerId);
}

// 보관함에서 복구. 함께 보관됐던 하위 트리를 같이 되돌린다. getProjectAccess는 보관된
// 항목을 "없음"으로 취급하므로(lib/projects.ts) 여기서는 직접 조회해 권한을 확인한다.
export async function restoreProject(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !project.deletedAt) throw new Error("보관된 프로젝트가 아닙니다.");

  const { isOwner } = await getPartnerAccess(project.partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (project.masterId !== session.user.id && !isOwner && !session.user.isSuperAdmin) {
    throw new Error("master, 파트너 owner, 총관리자만 복구할 수 있습니다.");
  }

  const all = await prisma.project.findMany({
    where: { partnerId: project.partnerId },
    select: { id: true, parentId: true },
  });
  const subtreeIds = [projectId, ...collectDescendantIds(all, projectId)];

  await prisma.project.updateMany({ where: { id: { in: subtreeIds } }, data: { deletedAt: null } });
  await revalidateProjectViews(project.partnerId);
  revalidatePath("/settings");
}

// 보관함에서의 2차 삭제 — 되돌릴 수 없다(D3). typed confirm으로 재확인한다.
export async function hardDeleteProject(
  projectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !project.deletedAt) throw new Error("보관된 프로젝트가 아닙니다.");

  const { isOwner } = await getPartnerAccess(project.partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (project.masterId !== session.user.id && !isOwner && !session.user.isSuperAdmin) {
    throw new Error("master, 파트너 owner, 총관리자만 영구 삭제할 수 있습니다.");
  }

  const confirmText = formData.get("confirm") as string | null;
  if (confirmText !== "영구삭제") return "'영구삭제'를 정확히 입력하세요.";

  const all = await prisma.project.findMany({
    where: { partnerId: project.partnerId },
    select: { id: true, parentId: true },
  });
  const subtreeIds = [projectId, ...collectDescendantIds(all, projectId)];

  await prisma.$transaction([
    prisma.project.deleteMany({ where: { id: { in: subtreeIds } } }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DELETE_PROJECT",
        targetType: "PROJECT",
        targetId: project.id,
        partnerId: project.partnerId,
        message:
          subtreeIds.length > 1
            ? `"${project.title}" 프로젝트를 영구 삭제 (하위 ${subtreeIds.length - 1}건 포함)`
            : `"${project.title}" 프로젝트를 영구 삭제`,
      },
    }),
  ]);

  revalidatePath("/settings");
}
