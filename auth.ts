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

      // DB가 잠깐 끊긴 것과 "계정이 실제로 없어졌다"를 구분해야 한다. 조회가 예외로
      // 실패했는데 세션을 무효화하면, DB 장애 몇 초 동안 전원이 로그아웃되고
      // 로그인도 DB를 타므로 "다시 시도" 무한 루프에 빠진다(실제로 겪었다).
      // 이 토큰은 발급 시점에 검증됐고 서명도 유효하므로, 조회 실패 때는 그대로 통과시킨다.
      // 장애 중에는 어차피 다른 화면도 못 여니 권한이 잠시 남아도 노출되는 것이 없다.
      let dbUser: { isActive: boolean; isSuperAdmin: boolean } | null;
      try {
        dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { isActive: true, isSuperAdmin: true },
        });
      } catch {
        return token;
      }

      // DB가 정상 응답했는데 없거나 비활성이면 그때만 세션을 끊는다.
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
