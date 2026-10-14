"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listPartnerOptions } from "@/lib/partners";
import { listAllProjectsForUser, projectMatchesQuery } from "@/lib/projects";

export type SearchHit = {
  kind: "partner" | "project" | "task" | "comment";
  id: string;
  title: string;
  /** 어디에 있는 것인지(파트너명 · 프로젝트명 등) */
  context: string;
  href: string;
  color: string | null;
  done: boolean;
};

const PER_KIND = 8;

// 상단 바의 전체 검색(Ctrl+K). 파트너·프로젝트·태스크·코멘트를 한 번에 찾는다.
//
// 볼 수 있는 범위는 목록 화면의 규칙을 그대로 쓴다 — 검색에 따로 규칙을 두면 언젠가
// 어긋나고, 그때 새는 것은 비공개 프로젝트다. 태스크·코멘트는 볼 수 있는 프로젝트 안의
// 것만 찾는다.
//
// 프로젝트는 목록 검색창과 같은 판정(projectMatchesQuery: 이름 + 담당자·참여자 이름)을 쓴다. 2000건
// 실측에서 전체 조회 + 메모리 필터가 150ms 안쪽이라 따로 DB 검색을 만들지 않았다.
export async function searchEverything(rawQuery: string): Promise<SearchHit[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const q = rawQuery.trim();
  if (!q) return [];

  const userId = session.user.id;
  const isSuperAdmin = !!session.user.isSuperAdmin;

  const [partners, allProjects] = await Promise.all([
    listPartnerOptions(userId, isSuperAdmin),
    listAllProjectsForUser(userId, isSuperAdmin, {}),
  ]);

  const needle = q.toLowerCase();
  const projectById = new Map(allProjects.map((p) => [p.id, p]));
  const projectHref = (p: { id: string; partnerId: string }) => `/partners/${p.partnerId}?project=${p.id}`;
  const visibleIds = allProjects.map((p) => p.id);

  const [tasks, comments] = visibleIds.length
    ? await Promise.all([
        prisma.taskItem.findMany({
          where: { projectId: { in: visibleIds }, title: { contains: q, mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
          take: PER_KIND,
          select: { id: true, title: true, done: true, projectId: true },
        }),
        prisma.comment.findMany({
          where: { projectId: { in: visibleIds }, body: { contains: q, mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
          take: PER_KIND,
          select: { id: true, body: true, projectId: true, author: { select: { name: true } } },
        }),
      ])
    : [[], []];

  const partnerHits: SearchHit[] = partners
    .filter((p) => p.name.toLowerCase().includes(needle))
    .slice(0, PER_KIND)
    .map((p) => ({
      kind: "partner",
      id: p.id,
      title: p.name,
      context: "파트너",
      href: `/partners/${p.id}`,
      color: p.color,
      done: false,
    }));

  const projectHits: SearchHit[] = allProjects
    .filter((p) => projectMatchesQuery(p, q))
    // 끝난 일보다 지금 하는 일을 먼저.
    .sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE"))
    .slice(0, PER_KIND)
    .map((p) => ({
      kind: "project",
      id: p.id,
      title: p.title,
      context: p.partnerName,
      href: projectHref(p),
      color: p.partnerColor,
      done: p.status === "DONE",
    }));

  const taskHits: SearchHit[] = tasks.map((t) => {
    const p = projectById.get(t.projectId)!;
    return {
      kind: "task",
      id: t.id,
      title: t.title,
      context: `${p.partnerName} · ${p.title}`,
      href: projectHref(p),
      color: p.partnerColor,
      done: t.done,
    };
  });

  const commentHits: SearchHit[] = comments.map((c) => {
    const p = projectById.get(c.projectId)!;
    return {
      kind: "comment",
      id: c.id,
      title: excerpt(c.body, q),
      context: `${c.author.name} · ${p.title}`,
      href: projectHref(p),
      color: p.partnerColor,
      done: p.status === "DONE",
    };
  });

  return [...partnerHits, ...projectHits, ...taskHits, ...commentHits];
}

// 긴 코멘트는 찾은 낱말 둘레만 잘라 보여 준다. 앞부분만 자르면 찾은 말이 안 보일 수 있다.
function excerpt(body: string, q: string, radius = 40) {
  const flat = body.replace(/\s+/g, " ");
  const at = flat.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0 || flat.length <= radius * 2) return flat.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + q.length + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}
