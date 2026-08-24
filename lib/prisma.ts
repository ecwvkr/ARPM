import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Supabase 풀러가 뒤쪽 DB를 잠깐 못 찾는 일이 있다(nxdomain). 몇 초 안에 돌아오지만
// 그 사이 요청은 전부 500이 되고, 화면 전체가 "문제가 발생했습니다"로 바뀐다.
// 연결을 맺지 못한 경우에 한해 짧게 두 번 다시 시도한다.
//
// 연결 실패는 쿼리가 아예 실행되지 않았다는 뜻이라 쓰기 작업을 재시도해도 중복이
// 생기지 않는다. 쿼리가 서버에 도달한 뒤의 오류(제약 위반 등)는 재시도하지 않는다.
const RETRY_DELAYS_MS = [150, 500];

function isConnectionError(error: unknown): boolean {
  // P1001: 서버에 닿을 수 없음, P1002: 연결 타임아웃, P1017: 서버가 연결을 끊음
  const code = (error as { code?: string })?.code;
  if (code === "P1001" || code === "P1002" || code === "P1017") return true;

  // 어댑터가 감싼 드라이버 오류는 코드 없이 메시지로만 오는 경우가 있다.
  const text = `${(error as { message?: string })?.message ?? ""} ${JSON.stringify(
    (error as { cause?: unknown })?.cause ?? "",
  )}`;
  return /nxdomain|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|Closed connection|Connection terminated/i.test(
    text,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createClient() {
  return new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ query, args }) {
        let lastError: unknown;
        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            if (!isConnectionError(error)) throw error;
            lastError = error;
            if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
          }
        }
        throw lastError;
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
