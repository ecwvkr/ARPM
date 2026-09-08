import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCommentFeed, groupByProject } from "@/lib/comments";
import { toCommentFilter, COMMENT_FILTERS } from "@/lib/comment-filters";
import { listAllUsers } from "@/app/actions/users";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";
import { ProjectDeepLink } from "@/app/partners/[partnerId]/project-deep-link";
import { CommentList } from "./comment-list";
import { CommentFilters } from "./filters";

export default async function CommentsPage({ searchParams }: PageProps<"/comments">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const myName = session.user.name ?? "";
  const isSuperAdmin = !!session.user.isSuperAdmin;
  const params = await searchParams;

  const filter = toCommentFilter(typeof params.filter === "string" ? params.filter : undefined);
  // 기본은 묶어보기 — 한 프로젝트의 이야기가 목록 곳곳에 흩어지지 않는 쪽이 훑기 좋다.
  const layout = params.layout === "flat" ? "flat" : "group";

  const [items, users] = await Promise.all([
    listCommentFeed(userId, isSuperAdmin, filter, myName),
    listAllUsers(),
  ]);

  const heading = COMMENT_FILTERS.find((f) => f.key === filter)!.label;

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <h1 className="text-base font-bold">{heading}</h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>

      <WidthContainer mainClassName="space-y-4 px-6 py-6">
        <CommentFilters filter={filter} layout={layout} />

        <CommentList
          // 개별 뷰는 최신순 그대로, 묶어보기 뷰는 프로젝트별로 묶어서 넘긴다.
          groups={layout === "group" ? groupByProject(items) : null}
          items={items}
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
