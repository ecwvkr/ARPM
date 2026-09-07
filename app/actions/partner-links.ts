"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNoticeAccess } from "@/lib/notices";
import { normalizeLink } from "@/lib/normalize";

// 카드가 보이는 곳은 그 파트너 화면 하나뿐이다.
function revalidatePartner(partnerId: string) {
  revalidatePath(`/partners/${partnerId}`);
}

// 제목과 주소를 함께 확인한다. 주소는 normalizeLink가 http(s)만 통과시키므로
// javascript: 같은 주소가 카드 버튼에 실리지 않는다.
function readFields(formData: FormData): { title: string; url: string } | string {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return "제목을 입력하세요.";

  const url = normalizeLink(formData.get("url") as string | null);
  if (url === undefined) return "올바른 링크를 입력하세요. (예: https://example.com)";
  if (url === null) return "링크를 입력하세요.";

  return { title, url };
}

export async function createPartnerLink(
  partnerId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { canManage } = await getNoticeAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canManage) return "이 파트너에 참여한 사람만 링크를 추가할 수 있습니다.";

  const fields = readFields(formData);
  if (typeof fields === "string") return fields;

  await prisma.partnerLink.create({
    data: { partnerId, ...fields, createdById: session.user.id },
  });
  revalidatePartner(partnerId);
}

export async function updatePartnerLink(
  linkId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const link = await prisma.partnerLink.findUnique({
    where: { id: linkId },
    select: { partnerId: true },
  });
  if (!link) return "링크를 찾을 수 없습니다.";

  // 권한은 폼에 실려 온 값이 아니라 저장된 링크의 소속으로 판단한다.
  const { canManage } = await getNoticeAccess(link.partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canManage) return "수정할 권한이 없습니다.";

  const fields = readFields(formData);
  if (typeof fields === "string") return fields;

  await prisma.partnerLink.update({ where: { id: linkId }, data: fields });
  revalidatePartner(link.partnerId);
}

export async function deletePartnerLink(linkId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const link = await prisma.partnerLink.findUnique({
    where: { id: linkId },
    select: { partnerId: true },
  });
  if (!link) return;

  const { canManage } = await getNoticeAccess(link.partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canManage) throw new Error("삭제할 권한이 없습니다.");

  await prisma.partnerLink.delete({ where: { id: linkId } });
  revalidatePartner(link.partnerId);
}
