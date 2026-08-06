import { IconLogout } from "@tabler/icons-react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button variant="outline" size="icon" type="submit" title="로그아웃" aria-label="로그아웃" className="size-11">
        <IconLogout className="size-4" />
      </Button>
    </form>
  );
}
