"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNoticeAccess } from "@/lib/notices";

// 공지가 보이는 화면은 둘뿐이다 — 전체공지는 대시보드, 파트너 공지는 그 파트너 탭.
function revalidateNoticeViews(partnerId: string | null) {
  revalidatePath(partnerId ? `/partners/${partnerId}` : "/");
}

// 폼에서 온 partnerId를 정규화한다. 대시보드(전체공지)에서는 빈 값으로 온다.
function partnerIdOf(formData: FormData): string | null {
  const raw = formData.get("partnerId") as string | null;
  return raw ? raw : null;
}

export async function createNotice(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const partnerId = partnerIdOf(formData);
  const { canManage } = await getNoticeAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canManage) return "이 파트너에 참여한 사람만 공지를 쓸 수 있습니다.";

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";
  const body = (formData.get("body") as string | null)?.trim();
  if (!body) return "내용을 입력하세요.";

  await prisma.notice.create({
    data: { partnerId, title, body, createdById: session.user.id },
  });
  revalidateNoticeViews(partnerId);
}

export async function updateNotice(
  noticeId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notice = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: { partnerId: true },
  });
  if (!notice) return "공지를 찾을 수 없습니다.";

  // 권한은 폼에 실려 온 값이 아니라 저장된 공지의 소속으로 판단한다.
  const { canManage } = await getNoticeAccess(notice.partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canManage) return "수정할 권한이 없습니다.";

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";
  const body = (formData.get("body") as string | null)?.trim();
  if (!body) return "내용을 입력하세요.";

  await prisma.notice.update({
    where: { id: noticeId },
    data: { title, body, updatedById: session.user.id },
  });
  revalidateNoticeViews(notice.partnerId);
}

export async function deleteNotice(noticeId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notice = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: { partnerId: true },
  });
  if (!notice) return;

  const { canManage } = await getNoticeAccess(notice.partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canManage) throw new Error("삭제할 권한이 없습니다.");

  await prisma.notice.delete({ where: { id: noticeId } });
  revalidateNoticeViews(notice.partnerId);
}
