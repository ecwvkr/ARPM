import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";
import { AccentColorForm } from "./accent-color-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b-[0.5px] px-6 py-4">
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
      </WidthContainer>
    </div>
  );
}
