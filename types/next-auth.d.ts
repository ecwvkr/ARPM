import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isSuperAdmin: boolean;
      accentColor: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    isSuperAdmin: boolean;
    accentColor: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    isSuperAdmin: boolean;
    accentColor: string | null;
  }
}
