import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";
import { SectionCard } from "@/components/ui/section-card";
import { AccentColorForm } from "./accent-color-form";
import { CreateAccountForm } from "./create-account-form";
import { MyNameForm } from "./my-name-form";
import { ChangePasswordForm } from "./change-password-form";
import { UserManagement } from "./user-management";
import { AppSettingsForm } from "./app-settings-form";
import { TrashSection } from "./trash-section";
import { listAllUsersForAdmin } from "@/app/actions/admin";
import { getCommentVisibleCount } from "@/lib/settings";
import { listTrashedPartners } from "@/lib/partners";
import { listTrashedProjects } from "@/lib/projects";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isSuperAdmin = !!session.user.isSuperAdmin;
  const users = isSuperAdmin ? await listAllUsersForAdmin() : [];
  const commentVisibleCount = isSuperAdmin ? await getCommentVisibleCount() : 0;
  const [trashedPartners, trashedProjects] = await Promise.all([
    listTrashedPartners(session.user.id, isSuperAdmin),
    listTrashedProjects(session.user.id, isSuperAdmin),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <h1 className="text-base font-bold">설정</h1>
          <LogoutButton />
        </div>
      </header>

      <WidthContainer mainClassName="space-y-4 px-6 py-6">
        <SectionCard title="내 계정">
          <div className="max-w-sm space-y-1">
            <p className="text-xs text-muted-foreground">이름</p>
            <MyNameForm name={session.user.name ?? ""} />
          </div>
          <p className="text-xs text-muted-foreground">아이디: {session.user.email}</p>
          <ChangePasswordForm />
        </SectionCard>

        <SectionCard title="포인트 컬러">
          <p className="text-sm text-muted-foreground">
            앱 전체에서 강조색으로 쓰이는 색상입니다. 기본값으로 되돌리면 원래 파란색을 사용합니다.
          </p>
          <AccentColorForm currentColor={session.user.accentColor} />
        </SectionCard>

        <SectionCard title="보관함">
          <p className="text-sm text-muted-foreground">
            보관된 파트너·프로젝트를 복구하거나 영구 삭제합니다. 영구 삭제는 되돌릴 수 없습니다.
          </p>
          <TrashSection partners={trashedPartners} projects={trashedProjects} />
        </SectionCard>

        {isSuperAdmin && (
          <>
            <SectionCard title="계정 발급">
              <p className="text-sm text-muted-foreground">
                새 팀원 계정을 직접 발급합니다. 자유 가입은 지원하지 않습니다.
              </p>
              <CreateAccountForm />
            </SectionCard>

            <SectionCard title={`사용자 관리 (${users.length})`}>
              <UserManagement users={users} />
            </SectionCard>

            <SectionCard title="글로벌 설정">
              <p className="text-sm text-muted-foreground">
                프로젝트 상세의 코멘트는 최신 순으로 이 개수만큼만 기본 노출되고, 나머지는 &quot;더보기&quot;로 펼칩니다.
              </p>
              <AppSettingsForm commentVisibleCount={commentVisibleCount} />
            </SectionCard>
          </>
        )}
      </WidthContainer>
    </div>
  );
}
