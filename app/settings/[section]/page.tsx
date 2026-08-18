import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { WidthContainer } from "@/components/width-container";
import { AccentColorForm } from "../accent-color-form";
import { MyNameForm } from "../my-name-form";
import { ChangePasswordForm } from "../change-password-form";
import { UserManagement } from "../user-management";
import { AppSettingsForm } from "../app-settings-form";
import { TrashSection } from "../trash-section";
import { SETTINGS_SECTIONS } from "../sections";
import { listAllUsersForAdmin } from "@/app/actions/admin";
import { getCommentVisibleCount } from "@/lib/settings";
import { listTrashedPartners } from "@/lib/partners";
import { listTrashedProjects } from "@/lib/projects";
import { IconChevronLeft } from "@tabler/icons-react";

export default async function SettingsSectionPage({ params }: PageProps<"/settings/[section]">) {
  const { section: slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isSuperAdmin = !!session.user.isSuperAdmin;
  const section = SETTINGS_SECTIONS.find((s) => s.slug === slug);
  // 목록에서 감추는 것만으로는 주소를 직접 치는 접근을 못 막으므로 여기서도 막는다.
  if (!section || (section.adminOnly && !isSuperAdmin)) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2">
          <Link
            href="/settings"
            aria-label="설정으로 돌아가기"
            className="-ml-2 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconChevronLeft className="size-5" />
          </Link>
          <h1 className="text-base font-bold">{section.title}</h1>
        </div>
      </header>

      <WidthContainer mainClassName="space-y-3 px-6 py-6">
        <p className="text-sm text-muted-foreground">{section.description}</p>
        {slug === "account" && (
          <div className="space-y-2">
            <div className="max-w-sm space-y-1">
              <p className="text-xs text-muted-foreground">이름</p>
              <MyNameForm name={session.user.name ?? ""} />
            </div>
            <p className="text-xs text-muted-foreground">아이디: {session.user.email}</p>
            <ChangePasswordForm />
          </div>
        )}
        {slug === "appearance" && <AccentColorForm currentColor={session.user.accentColor} />}
        {slug === "trash" && <TrashPanel userId={session.user.id} isSuperAdmin={isSuperAdmin} />}
        {slug === "users" && <UserPanel />}
        {slug === "app" && <AppSettingsPanel />}
      </WidthContainer>
    </div>
  );
}

async function TrashPanel({ userId, isSuperAdmin }: { userId: string; isSuperAdmin: boolean }) {
  const [partners, projects] = await Promise.all([
    listTrashedPartners(userId, isSuperAdmin),
    listTrashedProjects(userId, isSuperAdmin),
  ]);
  return <TrashSection partners={partners} projects={projects} />;
}

async function UserPanel() {
  const users = await listAllUsersForAdmin();
  return <UserManagement users={users} />;
}

async function AppSettingsPanel() {
  return <AppSettingsForm commentVisibleCount={await getCommentVisibleCount()} />;
}
