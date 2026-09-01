// 프로필 사진이 참여자 칩에 실제로 뜨는지 확인한다. 실행:
//   npm run check:avatar
//
// 칩(components/ui/avatar-stack.tsx)은 레이아웃이 내려 준 목록에 있는 사람만 사진을
// 요청한다. 그 목록(lib/avatars.ts)과 실제 저장 상태가 어긋나면, 사진을 올렸는데도
// 남의 화면에는 첫 글자만 계속 보인다. 예전에 사진 없음(404) 응답을 하루 캐시해 두어
// 새로 올린 사진이 하루 동안 안 보이던 문제가 있었다 — 그래서 주소에 버전을 붙인다.
//
// 읽기만 한다 — 아무것도 만들거나 지우지 않는다.
import { prisma } from "../lib/prisma";
import { listAvatarVersions } from "../lib/avatars";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

// 라우트(app/api/avatar/[userId]/route.ts)가 쓰는 것과 같은 형식 검사.
const DATA_URL = /^data:(image\/[a-z]+);base64,(.+)$/;

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, avatarUrl: true, avatarUpdatedAt: true },
  });
  const versions = await listAvatarVersions();

  const withPhoto = users.filter((u) => u.avatarUrl);
  const withoutPhoto = users.filter((u) => !u.avatarUrl);
  console.log(`사용자 ${users.length}명 · 사진 있음 ${withPhoto.length}명`);

  for (const u of withPhoto) {
    check(`${u.name}: 목록에 포함`, u.id in versions);
    check(`${u.name}: 버전 있음`, !!versions[u.id] && versions[u.id] !== "0", versions[u.id] ?? "");
    // 라우트가 이미지로 못 바꾸면 칩에 깨진 그림이 뜬다.
    const match = u.avatarUrl!.match(DATA_URL);
    check(`${u.name}: 이미지로 변환 가능`, !!match, match ? match[1] : "형식 불일치");
    if (match) {
      const bytes = Buffer.from(match[2], "base64");
      // JPEG는 FFD8, PNG는 89504E47로 시작한다.
      const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      check(`${u.name}: 실제 이미지 데이터`, isJpeg || isPng, `${Math.round(bytes.length / 1024)}KB`);
    }
  }

  for (const u of withoutPhoto) {
    // 목록에 잘못 들어가면 그 사람 칩마다 404 요청이 나간다.
    check(`${u.name}: 사진 없으므로 목록에서 제외`, !(u.id in versions));
  }

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
