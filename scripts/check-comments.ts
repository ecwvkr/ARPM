// 코멘트 모아보기(전체/멘션)를 확인한다. 실행:
//   npm run check:comments
//
// 두 가지가 어긋나기 쉽다.
//  · 볼 수 있는 범위 — 코멘트에 따로 권한 규칙을 두면 프로젝트 목록과 두 벌이 된다.
//    여기서는 listAllProjectsForUser가 걸러 준 프로젝트의 코멘트만 나오는지 본다.
//  · 멘션 판정 — 화면(칩)과 목록·개수가 같은 규칙이어야 "칩은 떴는데 목록에 없다"가
//    생기지 않는다.
//
// 읽기만 한다 — 아무것도 만들거나 지우지 않는다.
import { prisma } from "../lib/prisma";
import { listCommentFeed, groupByProject, mentionsName, countCommentSummary } from "../lib/comments";
import { koreanStamp } from "../lib/ui";
import { listAllProjectsForUser } from "../lib/projects";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

async function main() {
  // --- 멘션 판정: 화면 칩과 같은 규칙 ---
  check("이름을 부르면 멘션", mentionsName("@이대균 확인 부탁", "이대균"));
  check("글 중간의 멘션도 잡는다", mentionsName("자료 보고 @이대균 알려줘", "이대균"));
  // 이게 통과하면 이메일 주소가 들어간 코멘트가 멘션으로 잡힌다.
  check("이메일은 멘션이 아니다", !mentionsName("a@이대균.com 로 보냈어요", "이대균"));
  check("다른 이름은 안 잡는다", !mentionsName("@박천성 확인", "이대균"));
  // 이름이 다른 이름의 앞부분인 경우(이대 ⊂ 이대균) — @이대균은 '이대' 멘션이 아니다.
  check("짧은 이름이 긴 이름을 가로채지 않는다", mentionsName("@이대균", "이대균"));

  // --- 시각 표기: 환경(서버/브라우저, 개발기/운영기)에 따라 달라지면 안 된다 ---
  // toLocaleString("ko-KR")은 오전/오후를 그 환경의 로케일 자료에서 가져와서 "PM"으로
  // 나오는 곳이 있다. 클라이언트에서 찍으면 하이드레이션까지 깨진다(실제로 겪었다).
  const noon = new Date("2026-09-08T07:46:00Z"); // 한국시간 9/8 16:46
  check("오후 표기", koreanStamp(noon) === "2026. 9. 8. 오후 4:46", koreanStamp(noon));
  const morning = new Date("2026-09-07T23:05:00Z"); // 한국시간 9/8 08:05
  check("오전 표기 + 날짜 넘김", koreanStamp(morning) === "2026. 9. 8. 오전 8:05", koreanStamp(morning));
  const midnight = new Date("2026-09-07T15:00:00Z"); // 한국시간 9/8 00:00
  check("자정은 오전 12시", koreanStamp(midnight) === "2026. 9. 8. 오전 12:00", koreanStamp(midnight));
  const middaySharp = new Date("2026-09-08T03:00:00Z"); // 한국시간 9/8 12:00
  check("정오는 오후 12시", koreanStamp(middaySharp) === "2026. 9. 8. 오후 12:00", koreanStamp(middaySharp));

  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, isSuperAdmin: true } });

  for (const user of users) {
    const visible = await listAllProjectsForUser(user.id, user.isSuperAdmin, {});
    const visibleIds = new Set(visible.map((p) => p.id));

    // 필터 없이 = 볼 수 있는 모든 프로젝트의 코멘트.
    const feed = await listCommentFeed(user.id, user.isSuperAdmin, {});
    const leaked = feed.filter((c) => !visibleIds.has(c.projectId));
    check(`${user.name}: 볼 수 없는 프로젝트의 코멘트가 안 섞인다`, leaked.length === 0,
      `${feed.length}건`);
    check(`${user.name}: 최신순`, feed.every((c, i) => i === 0 || feed[i - 1].createdAt >= c.createdAt));

    // 기본 필터(진행 전·진행 중 + 내 프로젝트)
    const scoped = await listCommentFeed(user.id, user.isSuperAdmin, {
      statuses: ["TODO", "IN_PROGRESS"],
      mineOnly: true,
    });
    const wrongStatus = scoped.filter((c) => c.projectStatus === "DONE");
    check(`${user.name}: 기본 필터에 완료 프로젝트가 없다`, wrongStatus.length === 0, `${scoped.length}건`);
    const notMine = scoped.filter((c) => {
      const p = visible.find((x) => x.id === c.projectId)!;
      return p.masterId !== user.id && !p.participants.some((x) => x.userId === user.id);
    });
    check(`${user.name}: 기본 필터가 내 프로젝트만 남긴다`, notMine.length === 0);

    // 멘션 목록
    const mentions = await listCommentFeed(user.id, user.isSuperAdmin, { mentionName: user.name });
    check(`${user.name}: 멘션 목록이 전부 실제 멘션`,
      mentions.every((c) => mentionsName(c.body, user.name)), `${mentions.length}건`);
    // 묶음: 같은 프로젝트가 한 장으로 모이고, 묶음 순서는 그 안의 최신 코멘트 기준.
    const groups = groupByProject(feed);
    check(`${user.name}: 프로젝트마다 묶음이 하나`,
      new Set(groups.map((g) => g.projectId)).size === groups.length, `${groups.length}묶음`);
    check(`${user.name}: 묶음에 코멘트가 빠짐없이 들어간다`,
      groups.reduce((n, g) => n + g.comments.length, 0) === feed.length);
    check(`${user.name}: 묶음 안이 최신순`,
      groups.every((g) => g.comments.every((c, i) => i === 0 || g.comments[i - 1].createdAt >= c.createdAt)));
    check(`${user.name}: 묶음끼리도 최신순`,
      groups.every((g, i) => i === 0 || groups[i - 1].latestAt >= g.latestAt));
    check(`${user.name}: 한 묶음은 한 프로젝트의 코멘트만`,
      groups.every((g) => g.comments.every((c) => c.projectId === g.projectId)));

    // 멘션 목록은 완료된 프로젝트 묶음을 아래로 내린다.
    const mentionGroups = groupByProject(mentions, true);
    const firstDone = mentionGroups.findIndex((g) => g.projectDone);
    check(`${user.name}: 완료 프로젝트 묶음이 아래로`,
      firstDone === -1 || mentionGroups.slice(firstDone).every((g) => g.projectDone));

    // 카드 숫자와 화면 개수가 같아야 한다.
    const summary = await countCommentSummary(visible, user.id, user.name);
    check(`${user.name}: '전체 코멘트' 카드 숫자 = 기본 필터 개수`,
      summary.all === scoped.length, `${summary.all} vs ${scoped.length}`);
    check(`${user.name}: '멘션된 코멘트' 카드 숫자 = 멘션 개수`,
      summary.mentions === mentions.length, `${summary.mentions} vs ${mentions.length}`);
  }

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
