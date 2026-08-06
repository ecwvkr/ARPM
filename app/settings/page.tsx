import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";
import { AccentColorForm } from "./accent-color-form";
import { CreateAccountForm } from "./create-account-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 shadow-sm">
        <h1 className="text-base font-medium">설정</h1>
        <LogoutButton />
      </header>

      <WidthContainer mainClassName="space-y-6 px-6 py-6">
        <section className="space-y-2">
          <h2 className="text-sm font-medium">포인트 컬러</h2>
          <p className="text-sm text-muted-foreground">
            앱 전체에서 강조색으로 쓰이는 색상입니다. 기본값으로 되돌리면 원래 파란색을 사용합니다.
          </p>
          <AccentColorForm currentColor={session.user.accentColor} />
        </section>

        {session.user.isSuperAdmin && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">계정 관리</h2>
            <p className="text-sm text-muted-foreground">
              새 팀원 계정을 직접 발급합니다. 자유 가입은 지원하지 않습니다.
            </p>
            <CreateAccountForm />
          </section>
        )}
      </WidthContainer>
    </div>
  );
}
