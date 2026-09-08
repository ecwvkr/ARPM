import { prisma } from "@/lib/prisma";
import { listAllProjectsForUser } from "@/lib/projects";
import { koreanStamp } from "@/lib/ui";

// 코멘트 모아보기. 프로젝트 화면을 하나씩 열지 않아도 오간 이야기를 한 자리에서 훑고,
// 나를 부른 코멘트를 놓치지 않게 하려는 것이다.
//
// 볼 수 있는 범위는 프로젝트 목록과 똑같이 정한다 — listAllProjectsForUser가 이미
// 파트너 가시성과 비공개 프로젝트 규칙을 적용해 주므로, 거기서 나온 프로젝트의
// 코멘트만 읽으면 권한이 새지 않는다. 코멘트에 따로 규칙을 두면 두 벌이 되어 어긋난다.

// 한 번에 읽어 올 최대 건수. 무료 플랜에서 전체를 끌어오면 응답이 무거워지고, 실제로
// 훑는 것은 최근 것들이다.
const FEED_LIMIT = 200;

// 시각은 서버에서 문자열로 찍어 내려보낸다. 클라이언트에서 만들면 서버와 브라우저의
// 표기가 갈려 하이드레이션이 깨진다(실제로 그랬다 — 자세한 사정은 koreanStamp 참고).

export type CommentFeedItem = {
  id: string;
  body: string;
  /** 정렬용 원본 시각 */
  createdAt: Date;
  /** 화면에 그대로 찍는 문자열(서버에서 만든다) */
  createdAtLabel: string;
  authorName: string;
  authorId: string;
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  projectDone: boolean;
  partnerId: string;
  partnerName: string;
  partnerColor: string | null;
};

export type CommentFeedFilters = {
  /** 비우면 상태로 거르지 않는다. */
  statuses?: string[];
  /** true면 내가 master이거나 참여자인 프로젝트만. */
  mineOnly?: boolean;
  /** 값이 있으면 그 이름으로 멘션된 코멘트만. */
  mentionName?: string;
};

// 코멘트 본문에서 "@이름"을 찾는다. 코멘트 멘션은 마커 없이 글자로만 저장되므로
// (작성 시 알림 대상만 따로 실린다) 화면·검색 모두 이름 대조로 판정한다 —
// components/linkify.tsx의 칩 렌더링과 같은 규칙이어야 결과가 어긋나지 않는다.
export function mentionsName(body: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)@${escaped}`).test(body);
}

export async function listCommentFeed(
  userId: string,
  isSuperAdmin: boolean,
  filters: CommentFeedFilters = {},
): Promise<CommentFeedItem[]> {
  const projects = await listAllProjectsForUser(userId, isSuperAdmin, {});

  const visible = projects.filter((p) => {
    if (filters.statuses?.length && !filters.statuses.includes(p.status)) return false;
    if (filters.mineOnly) {
      const involved = p.masterId === userId || p.participants.some((x) => x.userId === userId);
      if (!involved) return false;
    }
    return true;
  });
  if (visible.length === 0) return [];

  const byId = new Map(visible.map((p) => [p.id, p]));
  const comments = await prisma.comment.findMany({
    where: { projectId: { in: visible.map((p) => p.id) } },
    orderBy: { createdAt: "desc" },
    take: FEED_LIMIT,
    select: {
      id: true,
      body: true,
      createdAt: true,
      projectId: true,
      authorId: true,
      author: { select: { name: true } },
    },
  });

  const items = comments.map((c) => {
    const project = byId.get(c.projectId)!;
    return {
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      createdAtLabel: koreanStamp(c.createdAt),
      authorName: c.author.name,
      authorId: c.authorId,
      projectId: project.id,
      projectTitle: project.title,
      projectStatus: project.status,
      projectDone: project.completedAt !== null || project.status === "DONE",
      partnerId: project.partnerId,
      partnerName: project.partnerName,
      partnerColor: project.partnerColor,
    };
  });

  if (!filters.mentionName) return items;
  return items.filter((item) => mentionsName(item.body, filters.mentionName!));
}

export type CommentGroup = {
  projectId: string;
  projectTitle: string;
  projectDone: boolean;
  partnerId: string;
  partnerName: string;
  partnerColor: string | null;
  /** 이 묶음에서 가장 최근 코멘트 시각 — 묶음끼리의 정렬 기준 */
  latestAt: Date;
  comments: CommentFeedItem[];
};

// 같은 프로젝트의 코멘트는 한 장에 묶는다. 한 프로젝트에서 오간 이야기가 목록 곳곳에
// 흩어지면 흐름을 읽을 수 없다.
//
// 묶음 순서는 그 안에서 가장 최근 코멘트를 기준으로 하므로 "최신순"이라는 성질은
// 그대로다 — 방금 코멘트가 달린 프로젝트가 항상 맨 위에 온다.
//
// doneAtEnd는 멘션 목록용이다. 완료된 프로젝트는 지금 챙길 것이 아니라서 아래로
// 내린다(지우지는 않는다 — 흐리게 두어 지난 것임을 알 수 있게 한다).
export function groupByProject(items: CommentFeedItem[], doneAtEnd = false): CommentGroup[] {
  const groups = new Map<string, CommentGroup>();

  for (const item of items) {
    const existing = groups.get(item.projectId);
    if (existing) {
      existing.comments.push(item);
      continue;
    }
    groups.set(item.projectId, {
      projectId: item.projectId,
      projectTitle: item.projectTitle,
      projectDone: item.projectDone,
      partnerId: item.partnerId,
      partnerName: item.partnerName,
      partnerColor: item.partnerColor,
      // items가 이미 최신순이므로 각 묶음에서 처음 만난 코멘트가 그 묶음의 최신이다.
      latestAt: item.createdAt,
      comments: [item],
    });
  }

  return [...groups.values()].sort(
    (a, b) =>
      (doneAtEnd ? Number(a.projectDone) - Number(b.projectDone) : 0) ||
      b.latestAt.getTime() - a.latestAt.getTime(),
  );
}

// 대시보드 요약 카드 2종의 숫자.
//  · 전체 코멘트 = 코멘트 목록의 기본 필터(진행 전·진행 중 + 내 프로젝트)와 같은 범위.
//    카드에 적힌 수와 눌러서 들어간 화면의 개수가 달라 보이면 안 된다.
//  · 멘션된 코멘트 = 내 이름이 불린 코멘트 전부(완료된 것 포함 — 화면에서도 아래로
//    내릴 뿐 지우지는 않는다).
//
// 대시보드가 이미 읽어 온 프로젝트 목록을 그대로 받아 같은 조회를 반복하지 않는다.
export async function countCommentSummary(
  projects: {
    id: string;
    status: string;
    masterId: string;
    participants: { userId: string }[];
  }[],
  userId: string,
  myName: string,
): Promise<{ all: number; mentions: number }> {
  if (projects.length === 0) return { all: 0, mentions: 0 };

  const mineActiveIds = projects
    .filter(
      (p) =>
        p.status !== "DONE" &&
        (p.masterId === userId || p.participants.some((x) => x.userId === userId)),
    )
    .map((p) => p.id);

  const [all, mentionCandidates] = await Promise.all([
    mineActiveIds.length
      ? prisma.comment.count({ where: { projectId: { in: mineActiveIds } } })
      : Promise.resolve(0),
    // "@이름"이 들어간 것만 먼저 좁히고, 앞이 공백인지는 메모리에서 본다 —
    // 이메일(a@이름)까지 세지 않으려면 화면과 같은 규칙이어야 한다.
    myName
      ? prisma.comment.findMany({
          where: { projectId: { in: projects.map((p) => p.id) }, body: { contains: `@${myName}` } },
          select: { body: true },
        })
      : Promise.resolve([]),
  ]);

  return { all, mentions: mentionCandidates.filter((c) => mentionsName(c.body, myName)).length };
}
