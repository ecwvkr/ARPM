"use server";

import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) throw new Error("총관리자만 접근할 수 있습니다.");
  return session;
}

// 총관리자 권한 해제·비활성화 시 시스템에 총관리자가 0명이 되는 잠금 사고를 막는다.
async function assertNotLastActiveSuperAdmin(excludeUserId: string) {
  const remaining = await prisma.user.count({
    where: { isSuperAdmin: true, isActive: true, id: { not: excludeUserId } },
  });
  if (remaining === 0) throw new Error("마지막 남은 총관리자는 해제·비활성화할 수 없습니다.");
}

export async function createUserAccount(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) return "총관리자만 계정을 생성할 수 있습니다.";

  const name = (formData.get("name") as string | null)?.trim();
  const email = normalizeEmail(formData.get("email") as string | null);
  const password = (formData.get("password") as string | null) ?? "";
  const isSuperAdmin = formData.get("isSuperAdmin") === "on";

  if (!name) return "이름을 입력하세요.";
  if (!email) return "이메일 또는 아이디를 입력하세요.";
  if (password.length < 8) return "비밀번호는 8자 이상이어야 합니다.";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return "이미 사용 중인 이메일 또는 아이디입니다.";

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash, isSuperAdmin },
  });
  revalidatePath("/settings/users");
}

export async function listAllUsersForAdmin() {
  await requireSuperAdmin();

  return prisma.user.findMany({
    select: { id: true, name: true, email: true, isSuperAdmin: true, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function updateUserInfo(userId: string, _prevState: string | undefined, formData: FormData) {
  await requireSuperAdmin();

  const name = (formData.get("name") as string | null)?.trim();
  const email = normalizeEmail(formData.get("email") as string | null);
  if (!name) return "이름을 입력하세요.";
  if (!email) return "이메일 또는 아이디를 입력하세요.";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) return "이미 사용 중인 이메일 또는 아이디입니다.";

  await prisma.user.update({ where: { id: userId }, data: { name, email } });
  revalidatePath("/settings/users");
}

export async function resetUserPassword(userId: string, _prevState: string | undefined, formData: FormData) {
  await requireSuperAdmin();

  const newPassword = (formData.get("newPassword") as string | null) ?? "";
  if (newPassword.length < 8) return "비밀번호는 8자 이상이어야 합니다.";

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function toggleUserSuperAdmin(userId: string) {
  await requireSuperAdmin();

  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.isSuperAdmin) {
    await assertNotLastActiveSuperAdmin(userId);
  }
  await prisma.user.update({ where: { id: userId }, data: { isSuperAdmin: !target.isSuperAdmin } });
  revalidatePath("/settings/users");
}

export async function toggleUserActive(userId: string) {
  await requireSuperAdmin();

  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.isActive && target.isSuperAdmin) {
    await assertNotLastActiveSuperAdmin(userId);
  }
  await prisma.user.update({ where: { id: userId }, data: { isActive: !target.isActive } });
  revalidatePath("/settings/users");
}

// 계정 영구 삭제. 되돌릴 수 없으므로 비활성 상태에서만, typed confirm으로 한 번 더 확인받는다.
// 그 사람이 만든 프로젝트·코멘트·감사로그는 FK가 RESTRICT라 남아 있으면 삭제가 막히므로
// 어떤 기록이 걸려 있는지 사용자에게 알려준다(무엇을 먼저 정리해야 하는지 알 수 있게).
export async function deleteUserAccount(
  userId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await requireSuperAdmin();

  if ((formData.get("confirm") as string | null) !== "삭제") return "'삭제'를 정확히 입력하세요.";
  if (userId === session.user?.id) return "본인 계정은 삭제할 수 없습니다.";

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return "존재하지 않는 계정입니다.";
  if (target.isActive) return "비활성화한 계정만 삭제할 수 있습니다.";
  if (target.isSuperAdmin) await assertNotLastActiveSuperAdmin(userId);

  const [ownedPartners, masteredProjects, comments, auditLogs] = await Promise.all([
    prisma.partner.count({ where: { ownerId: userId } }),
    prisma.project.count({ where: { masterId: userId } }),
    prisma.comment.count({ where: { authorId: userId } }),
    prisma.auditLog.count({ where: { actorId: userId } }),
  ]);

  const blockers = [
    ownedPartners > 0 ? `파트너 owner ${ownedPartners}건` : null,
    masteredProjects > 0 ? `프로젝트 master ${masteredProjects}건` : null,
    comments > 0 ? `코멘트 ${comments}건` : null,
    auditLogs > 0 ? `활동 로그 ${auditLogs}건` : null,
  ].filter(Boolean);

  if (blockers.length > 0) {
    return `아직 연결된 기록이 있어 삭제할 수 없습니다 (${blockers.join(", ")}). 다른 사람에게 위임하거나 정리한 뒤 다시 시도하세요.`;
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/settings/users");
}
