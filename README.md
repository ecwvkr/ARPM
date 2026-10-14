# AR_PM

소규모 팀이 **파트너 → 프로젝트 → 태스크** 단위로 일을 공유하고 추적하는 웹앱입니다.
프로젝트가 무제한 깊이의 트리로 뻗고, 비공개 공유가 그 트리를 따라 자동으로 전파되는 것이 핵심입니다.

- 운영: https://allrounders-pm.vercel.app/
- 스택: Next.js 16 (App Router, Turbopack) · React 19 · Prisma 7 (드라이버 어댑터) · Auth.js v5 · Tailwind v4 · shadcn/ui (base-ui) · Tabler 아이콘 · React Flow + dagre
- 인프라: Vercel Hobby (서울 `icn1`) · Supabase Free (Postgres, 서울)

## 문서 지도

| 문서 | 언제 보나 |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | 이 제품이 무엇이고, 누가, 어떤 규칙으로 쓰는가 |
| [`DESIGN.md`](DESIGN.md) | 색·타이포·컴포넌트 규칙 (`.impeccable/design.json`이 같은 내용의 기계용 사본) |
| [`docs/ENGINEERING-NOTES.md`](docs/ENGINEERING-NOTES.md) | **코드를 고치기 전에.** 실제로 터졌던 함정과 지켜야 할 규칙 |
| [`docs/HISTORY.md`](docs/HISTORY.md) | 무엇이 언제, 왜 바뀌었나. 결정을 되돌리기 전에 |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | 남은 과제와 추천 순서 |
| [`docs/archive/BUILD-ORDER-v3.md`](docs/archive/BUILD-ORDER-v3.md) | 처음 작업지시서 (보관용, 지금과 다름) |
| `AGENTS.md` / `CLAUDE.md` | AI 작업자용 지시. `AGENTS.md`는 `next dev`가 자동으로 다시 쓴다 |

---

## ⚠️ 시작 전에 꼭 알아야 할 것

**로컬 개발과 운영이 같은 Supabase DB를 씁니다.**
- 로컬에서 만든 데이터는 팀원 화면에 그대로 보입니다. 테스트 데이터는 반드시 지웁니다.
- 마이그레이션은 적용하는 순간 운영에 반영됩니다.
- 분리 계획은 [`docs/BACKLOG.md`](docs/BACKLOG.md)의 O1을 보세요.

## 로컬 실행

```bash
npm install
```

```bash
npm run dev
```

`npm install`이 끝나면 `postinstall`이 Prisma Client를 생성합니다. 루트에 `.env`가 있어야 합니다(아래 표).
http://localhost:3000 에서 총관리자가 발급한 계정으로 로그인합니다. 자유 가입은 없습니다.

## 환경 변수

`.env`(로컬)과 Vercel → Settings → Environment Variables(운영)에 같은 이름으로 넣습니다.
**값은 채팅·이슈·커밋에 붙여넣지 않습니다.**

| 이름 | 필수 | Vercel 타입 | 용도 |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Secret | 앱 런타임 DB 연결. Supabase **트랜잭션 풀러(6543)**, `?pgbouncer=true` |
| `DIRECT_URL` | ✅ (로컬) | — | 마이그레이션 등 CLI용 **세션 연결(5432)**. `prisma.config.ts`가 읽는다 |
| `AUTH_SECRET` | ✅ | Secret | Auth.js 세션 서명 (`openssl rand -base64 32`) |
| `AUTH_URL` | 로컬 | — | `http://localhost:3000`. 운영은 없어도 된다(요청 헤더 → Vercel 고정 도메인 순으로 판단) |
| `CRON_SECRET` | ✅ | Secret | 매일 11:00 크론 인증. **없으면 크론이 401로 전부 거절된다** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 푸시 | Config(일반) | 웹 푸시 공개키. 브라우저로 나가는 값이라 비밀이 아니다 |
| `VAPID_PRIVATE_KEY` | 푸시 | Secret | 웹 푸시 비밀키 |
| `VAPID_SUBJECT` | 푸시 | Config | `mailto:` 주소 |
| `GOOGLE_CLIENT_ID` | 캘린더 | Secret | 구글 OAuth |
| `GOOGLE_CLIENT_SECRET` | 캘린더 | Secret | 구글 OAuth |
| `GOOGLE_TOKEN_KEY` | 캘린더 | Secret | 구글 토큰 암호화 키(AES-256-GCM) |

VAPID 키가 없으면 푸시만 조용히 꺼지고, 구글 값이 없으면 캘린더 연동만 꺼집니다. 나머지는 그대로 동작합니다.

## 데이터베이스 변경

1. `prisma/schema.prisma` 수정
2. `prisma/migrations/<타임스탬프>_<이름>/migration.sql`을 **직접 작성** — 새 테이블이면 반드시:
   ```sql
   ALTER TABLE "새테이블" ENABLE ROW LEVEL SECURITY;
   ```
   (정책 없음 = 공개 키로는 전부 거부. Prisma는 RLS를 우회하므로 앱은 영향 없음)
3. 적용(= **운영에 바로 반영**):
   ```bash
   npx prisma migrate deploy
   ```
4. Client 재생성 후 **dev 서버 재시작** — 안 하면 새 모델이 `undefined`로 나온다.
   ```bash
   npx prisma generate
   ```

기존 테이블은 **추가만** 합니다. 컬럼 삭제·이름 변경은 배포가 끝나기 전의 운영 코드를 깨뜨립니다.

## 검사

커밋 전에 기본 세 가지:

```bash
npx tsc --noEmit
```

```bash
npx eslint
```

```bash
npx next build
```

기능별 회귀 검사(`scripts/check-*.ts`). **DB 표시가 있는 것은 운영 DB에 접속하고, 일부는 쓰고 지웁니다.**

| 명령 | DB | 확인하는 것 |
|---|---|---|
| `npm run check:join` | 읽기 | 목록의 '참여하기'와 서버의 참여 판정이 전 사용자 × 전 프로젝트에서 일치 |
| `npm run check:tree` | 읽기 | 모든 하위 프로젝트가 상위와 같은 파트너에 있음 |
| `npm run check:notify` | 읽기 | 알림 종류마다 올바른 화면으로 가고, 저장된 알림이 전부 이동 가능 |
| `npm run check:deadline` | 읽기 | 마감·캘린더 D-1 판정(한국 날짜 기준) |
| `npm run check:avatar` | 읽기 | 프로필 사진 목록과 저장 상태 일치 |
| `npm run check:comments` | 읽기 | 코멘트 필터·묶기·카드 숫자 = 목록 개수 |
| `npm run check:chat` | **쓰기** | 채팅 권한·집계·읽음·페이지네이션·삭제·리액션 |
| `npm run check:notice` | **쓰기** | 공지 권한(전체/파트너) |
| `npm run check:partner-link` | **쓰기** | 바로가기 주소 검사·권한 |
| `npm run check:project-read` | **쓰기** | 미확인 빨간 점이 읽으면 꺼지고 완료되면 꺼짐 |
| `npm run check:crop` | 없음 | 프로필 사진 자르기 계산 |
| `npm run check:linkify` | 없음 | 주소 자동 링크·멘션 칩 |
| `npm run check:date-input` | 없음 | 날짜 입력 범위·없는 날짜 거부, 날짜 칸이 공용 Input을 쓰는지 |

## 배포

- `master`에 푸시하면 Vercel이 자동 배포합니다.
- 함수 리전은 `vercel.json`에서 **서울(`icn1`)로 고정**합니다. DB가 서울이라 다른 리전이면 왕복마다 약 200ms가 붙습니다(대시보드 5.9초 → 0.16초의 원인이었음).
- 크론: `vercel.json`의 `/api/cron/deadlines`, 매일 02:00 UTC(= 11:00 KST). Hobby 플랜은 크론 2개까지, 하루 1회까지입니다.
- 앱 아이콘을 바꾸면 `npm run generate:icons`로 192/512 PNG를 다시 만듭니다.

## 폴더 구조

```
app/                 화면(App Router)과 서버 액션(app/actions/)
  api/               인증, 아바타, 크론, 구글 OAuth
  partners/[id]/     파트너 화면 + 프로젝트 상세 대화창
  projects/ tasks/ comments/ calendar/ settings/
components/          공용 컴포넌트 (ui/ 는 shadcn 기반)
lib/                 조회·권한·알림 등 서버 로직. prisma를 쓰지 않는 순수 모듈은 클라이언트에서도 import 가능
prisma/              스키마, 손으로 쓴 마이그레이션, 시드
scripts/             check-* 회귀 검사, 아이콘 생성
docs/                변경 기록, 개발 규칙, 남은 과제, 보관 문서
```
