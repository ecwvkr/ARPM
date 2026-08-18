import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";
import { SETTINGS_SECTIONS } from "./sections";
import { IconChevronRight } from "@tabler/icons-react";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isSuperAdmin = !!session.user.isSuperAdmin;
  const sections = SETTINGS_SECTIONS.filter((s) => !s.adminOnly || isSuperAdmin);

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <h1 className="text-base font-bold">설정</h1>
          <LogoutButton />
        </div>
      </header>

      <WidthContainer mainClassName="space-y-2 px-6 py-6">
        {sections.map((section) => (
          <Link
            key={section.slug}
            href={`/settings/${section.slug}`}
            className="flex items-center justify-between gap-3 rounded-3xl bg-muted/40 p-4 transition-colors hover:bg-muted"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{section.title}</p>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </div>
            <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </WidthContainer>
    </div>
  );
}
