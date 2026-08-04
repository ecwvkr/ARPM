import { auth } from "@/auth";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b-[0.5px] px-6 py-4">
        <div>
          <h1 className="text-base font-medium">AR_PM</h1>
          <p className="text-sm text-muted-foreground">
            {session?.user?.name}님
          </p>
        </div>
        <LogoutButton />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-sm text-muted-foreground">
          아직 프로젝트가 없습니다.
        </p>
      </main>
    </div>
  );
}
