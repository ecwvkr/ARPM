import { prisma } from "@/lib/prisma";

// 파트너 공지 아래에 두는 링크 카드. 누가 보고 누가 고칠 수 있는지는 공지와 같으므로
// 권한은 lib/notices.ts의 getNoticeAccess를 그대로 쓴다(그 파트너 참여자만).
export type PartnerLinkItem = {
  id: string;
  title: string;
  url: string;
};

// 만든 순서대로. 화면에서는 이 순서로 나란히 놓는다.
export async function listPartnerLinks(partnerId: string): Promise<PartnerLinkItem[]> {
  return prisma.partnerLink.findMany({
    where: { partnerId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, url: true },
  });
}
