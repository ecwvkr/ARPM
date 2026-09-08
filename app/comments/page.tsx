import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCommentFeed, groupByProject } from "@/lib/comments";
import { listAllUsers } from "@/app/actions/users";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";
import { ProjectDeepLink } from "@/app/partners/[partnerId]/project-deep-link";
import { chipClass, toArray } from "@/lib/ui";
import { CommentList } from "./comment-list";
import { CommentFilters } from "./filters";

// 필터를 한 번도 안 건드린 순수 진입에서 쓰는 기본값. 진행 중인 일 위주로,
// 내가 관여하는 프로젝트만 — 전체를 다 띄우면 남의 파트너 이야기까지 섞여 훑기 어렵다.
const DEFAULT_STATUSES = ["TODO", "IN_PROGRESS"];

export default async function CommentsPage({ searchParams }: PageProps<"/comments">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const myName = session.user.name ?? "";
  const isSuperAdmin = !!session.user.isSuperAdmin;
  const params = await searchParams;

  const mentionView = params.view === "mention";
  // f=1이 붙었으면 사용자가 필터를 직접 만진 것이므로 빈 선택도 그대로 존중한다.
  const touched = typeof params.f === "string";
  const rawStatus = typeof params.status === "string" ? params.status : undefined;
  const selectedStatuses = touched ? toArray(rawStatus) : DEFAULT_STATUSES;
  const mineOnly = touched ? params.mine === "1" : true;

  const [items, users] = await Promise.all([
    listCommentFeed(userId, isSuperAdmin, {
      // 멘션 목록은 나를 부른 코멘트를 놓치지 않는 것이 목적이라 상태·참여로 거르지
      // 않는다. 완료된 프로젝트의 것은 지우는 대신 아래로 내리고 흐리게 둔다.
      statuses: mentionView ? undefined : selectedStatuses,
      mineOnly: mentionView ? false : mineOnly,
      mentionName: mentionView ? myName : undefined,
    }),
    listAllUsers(),
  ]);

  // 같은 프로젝트의 코멘트는 한 장에 묶는다. 멘션 목록에서는 완료된 프로젝트의 묶음을
  // 아래로 내린다.
  const groups = groupByProject(items, mentionView);

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <h1 className="text-base font-bold">{mentionView ? "멘션된 코멘트" : "전체 코멘트"}</h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>

      <WidthContainer mainClassName="space-y-4 px-6 py-6">
        <div className="flex items-center gap-2 text-xs">
          <Link href="/comments" className={chipClass(!mentionView)}>
            전체 코멘트
          </Link>
          <Link href="/comments?view=mention" className={chipClass(mentionView)}>
            멘션된 코멘트
          </Link>
        </div>

        {mentionView ? (
          <p className="text-sm text-muted-foreground">
            내 이름이 @로 불린 코멘트입니다. 완료된 프로젝트의 코멘트는 아래에 흐리게 표시됩니다.
          </p>
        ) : (
          <CommentFilters selectedStatuses={selectedStatuses} mineOnly={mineOnly} />
        )}

        <CommentList
          groups={groups}
          memberNames={users.map((u) => u.name)}
          myName={myName}
          currentUserId={userId}
        />
      </WidthContainer>

      {/* 코멘트를 누르면 ?project= 가 붙고 여기서 상세 창을 연다(프로젝트 카드와 같은 창). */}
      <ProjectDeepLink />
    </div>
  );
}
