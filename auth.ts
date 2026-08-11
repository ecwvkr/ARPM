import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "이메일 또는 아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      authorize: async (credentials) => {
        const rawEmail = credentials?.email;
        const password = credentials?.password;
        if (typeof rawEmail !== "string" || typeof password !== "string") {
          return null;
        }
        const email = normalizeEmail(rawEmail);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isSuperAdmin: user.isSuperAdmin,
          accentColor: user.accentColor,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // 방금 authorize에서 존재·활성 여부를 확인했으므로 재조회하지 않는다.
        token.id = user.id!;
        token.isSuperAdmin = user.isSuperAdmin;
        token.accentColor = user.accentColor;
        return token;
      }

      if (trigger === "update" && session?.user) {
        if (session.user.accentColor !== undefined) token.accentColor = session.user.accentColor;
        if (session.user.name !== undefined) token.name = session.user.name;
      }

      // JWT 세션은 발급 후 DB를 보지 않아, 계정이 삭제·비활성화돼도 만료 전까지
      // 그대로 통과한다(실제로 삭제된 계정의 세션이 총관리자 권한으로 남아 있었다).
      // 매 요청 PK 조회 1회로 존재·활성 여부를 확인하고, 아니면 세션을 무효화한다.
      // 권한(isSuperAdmin)도 함께 새로 읽어 부여·해제가 재로그인 없이 반영되게 한다.
      if (!token.id) return null;
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { isActive: true, isSuperAdmin: true },
      });
      if (!dbUser || !dbUser.isActive) return null;
      token.isSuperAdmin = dbUser.isSuperAdmin;

      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.isSuperAdmin = token.isSuperAdmin;
      session.user.accentColor = token.accentColor;
      return session;
    },
  },
});
