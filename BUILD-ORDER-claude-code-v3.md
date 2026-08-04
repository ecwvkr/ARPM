# 🛠️ Claude Code 작업지시서 v3 (최종) — 프로젝트·업무 관리 웹 툴

> Claude Code가 그대로 착수할 수 있는 **최종 빌드 명세**. (v1·v2 대체 · 이 문서가 최우선)
> **미확정 항목 없음.** 전 항목 확정.

---

## 0. 목표 · 원칙

- 소규모 신뢰 팀용, 프로젝트·참여자 기반 **업무 공유/관리** 툴.
- 차별점: 업무 **파생(트리)** 관계의 **캔버스(그래프) 시각화**.
- UI 언어 **한국어**, 디자인 **중립·미니멀**, 배포 **Vercel**.

---

## 1. 기술 스택 (확정)

| 레이어 | 선택 |
|---|---|
| 프레임워크 | **Next.js (App Router, TypeScript)** |
| 인증 | **Auth.js (Credentials) — 이메일+비밀번호** |
| DB | **PostgreSQL** (Vercel Postgres / Supabase) |
| ORM | **Prisma** |
| 스타일 | **Tailwind CSS + shadcn/ui** |
| 그래프 | **React Flow + dagre** |
| 해시 | **bcrypt** |

---

## 2. 인증 · 계정 (MVP)

- 자유 가입·OAuth 없음. 사용자는 **DB에 직접 입력해 발급**. 계정 관리 UI는 범위 밖.
- 로그인: 이메일 + 비밀번호 → `passwordHash`(bcrypt) 검증.
- 첫 **총관리자**는 시드 스크립트로 `isSuperAdmin=true` 유저 생성.
- **`prisma/seed.ts` 필수**: 총관리자 + 예시 유저 2~3명(해시 비밀번호).
- 전 페이지 로그인 보호, 미인증 시 `/login`.

---

## 3. 역할 · 권한 매트릭스 (확정)

| 액션 | 권한 |
|---|---|
| 계정 발급 | DB 직접 입력 (UI 없음) |
| 프로젝트 생성 | 로그인 유저(= owner) |
| 프로젝트 공개/비공개, 멤버 초대 | 프로젝트 **owner** |
| 프로젝트 **숨김 / 삭제(소프트)** | **총관리자만** |
| 업무 생성 · 파생 | 업무 접근 권한자(비공개 업무는 접근자) |
| 업무 **완료하기 · 기한 연장** | **참여자 누구나**(상속 접근자 포함) |
| 상태 변경(진행전→진행중 등) | 참여자 |
| 업무 공개/비공개, 참여자 초대·**공유 범위 지정**, master 위임 | 업무 **master** |
| 업무 **삭제(하드)** | 업무 **master만** |
| 참여/이탈 | 공개 업무=누구나 / 비공개 업무=초대·상속 접근자 |
| 본인 우선순위 설정 | 참여자(진행 중 업무만) |
| 코멘트 작성 | 업무 접근자 |

---

## 4. 데이터 모델 (Prisma)

> 선택 공유는 **스키마 변경 없이** `TaskParticipant`의 다중 grant + `includeSubtree` 플래그로 표현한다(§5.9).

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  phone        String?
  avatarUrl    String?
  passwordHash String
  isSuperAdmin Boolean  @default(false)
  createdAt    DateTime @default(now())

  ownedProjects      Project[]         @relation("ProjectOwner")
  projectMemberships ProjectMember[]
  masteredTasks      Task[]            @relation("TaskMaster")
  taskParticipations TaskParticipant[]
  priorities         TaskPriority[]
  comments           Comment[]
  notifications      Notification[]
}

model Project {
  id         String     @id @default(cuid())
  name       String
  goalDate   DateTime?
  visibility Visibility @default(PRIVATE)
  isArchived Boolean    @default(false)   // 숨김(총관리자)
  deletedAt  DateTime?                    // 소프트 삭제(총관리자)
  ownerId    String
  owner      User       @relation("ProjectOwner", fields: [ownerId], references: [id])
  createdAt  DateTime   @default(now())

  members ProjectMember[]
  tasks   Task[]
}

model ProjectMember {
  projectId String
  userId    String
  role      ProjectRole @default(MEMBER)
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([projectId, userId])
}

model Task {
  id          String     @id @default(cuid())
  projectId   String
  parentId    String?                        // 트리: 부모 1 (동일 프로젝트 내)
  title       String
  memo        String?
  status      TaskStatus @default(TODO)
  visibility  Visibility @default(PUBLIC)
  masterId    String
  createdAt   DateTime   @default(now())
  dueDate     DateTime?
  completedAt DateTime?

  project      Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent       Task?             @relation("TaskTree", fields: [parentId], references: [id], onDelete: SetNull)
  children     Task[]            @relation("TaskTree")
  master       User              @relation("TaskMaster", fields: [masterId], references: [id])
  participants TaskParticipant[]
  priorities   TaskPriority[]
  comments     Comment[]
}

model TaskParticipant {
  taskId         String
  userId         String
  includeSubtree Boolean  @default(true)   // false = '해당 업무만 공유'
  joinedAt       DateTime @default(now())
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([taskId, userId])
}

model TaskPriority {                          // 참여자별 우선순위
  taskId    String
  userId    String
  level     Priority @default(NORMAL)
  updatedAt DateTime @updatedAt
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([taskId, userId])
}

model Comment {
  id        String   @id @default(cuid())
  taskId    String
  authorId  String
  body      String
  createdAt DateTime @default(now())
  task   Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author User @relation(fields: [authorId], references: [id])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  refId     String?
  message   String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum Visibility  { PUBLIC PRIVATE }
enum ProjectRole { OWNER MEMBER }
enum TaskStatus  { TODO IN_PROGRESS DONE }
enum Priority    { URGENT HIGH NORMAL LOW }
```

---

## 5. 비즈니스 규칙 (반드시 준수)

1. **파생 트리**: 부모 1 : 자식 N, **무제한 깊이**. 파생 업무는 **부모와 동일 프로젝트**에 속함.
2. **서브트리 동반 이동**: 업무의 `parentId`를 바꾸면 자식은 해당 노드를 계속 가리키므로 **서브트리가 자동 동반 이동**.
3. **업무 삭제(하드)** — *확정*: 삭제 전 트랜잭션으로 `children.parentId = deleted.parentId`로 **끌어올려 보존**(연쇄 삭제 아님). 확인 모달에 **'삭제' 직접 입력**. 삭제 후 **참여자 + 총관리자 알림**.
4. **지연 플래그**: `isOverdue = dueDate < now() && status !== DONE` (파생값).
5. **완료 처리**: 참여자가 `완료하기` → `status=DONE`, `completedAt=now()`, **참여자 명단 스냅샷 고정**(이후 참여/이탈 불가).
6. **종료 후에도 파생 가능**: 종료된 업무·프로젝트에서도 파생 생성 허용.
7. **우선순위**: 참여자별, **진행 중(IN_PROGRESS) 업무에만**. 카드에 참여자별 표시. 기본 미설정(NORMAL 취급).
8. **정렬(대시보드)**: ① 마감 임박 순(오름차순, null 뒤) → ② 참여자 최고 우선순위 높은 순 → ③ 생성일 오래된 순. *지연 업무는 자연히 최상단.*

### 9. 비공개 업무 공유 — 서브트리 전파 + 동적 성장 (핵심)

- 비공개 업무는 master가 초대한 **접근자만** 열람·참여. 접근 권한 없는 유저에게는 **노드가 보이지 않음**.
- 참여자 초대 시 노드마다 **`includeSubtree`** 로 공유 범위 지정:
  - **`true`(기본, '하위 포함')**: 초대된 업무 **+ 그 하위 서브트리 전체** 접근.
  - **`false`('해당 업무만')**: **해당 업무만** 접근.
- **중도 참여**: 참여는 루트뿐 아니라 **트리 중간 노드**에도 지정 가능. 그 노드 기준으로 위 규칙 동일 적용.

**접근 판정 (read-time 계산, 저장하지 않음)**
- 유저 U가 비공개 업무 T에 접근 가능 ⇔
  `U=master` OR `U가 T의 직접 참여자` OR `T의 조상 A 중 U가 includeSubtree=true로 참여한 A가 존재`.
- 구현: T에서 부모를 거슬러 올라가며 위 조건을 검사(조상 walk). 목록·전체 업무 뷰·캔버스 렌더 시 모두 적용.
- 상속 접근자는 해당 서브트리에서 **참여자로 간주**(완료·연장 등 권한 보유). 카드 명단 표기는 실제 참여 시.

**선택(가지) 공유 = 권한 조합** *(스키마 변경 없음)*
- 임의의 가지 조합은 한 사람에게 **여러 grant를 조합**해 표현.
  - 예) `초대업무 + 하위1 가지만` 공유 → `초대업무(includeSubtree=false)` + `하위1(includeSubtree=true)`.
  - 결과: 초대업무·하위1·(하위1의 자손) 접근, `하위2`는 어느 조상도 true가 아니라 **숨김**.

**동적 성장 (트리가 나중에 자람)** — *확정*
- 접근이 read-time 계산이므로, **나중에 생기는 노드도 태어난 위치 기준으로 자동 판정**된다. 공유는 노드 스냅샷이 아니라 **'이 지점 아래' 상시 규칙**.
  - `includeSubtree=true` 지점 아래 **새 자손 → 자동 접근**.
  - `includeSubtree=false` 지점 아래 **새 자식 → 새 가지라 기본 숨김**. 필요 시 master가 그 가지에 grant 추가.
- **재배치**: 업무 이동 시 접근은 **새 위치 기준 재계산**(공유 영역 안으로 들어오면 노출, 밖으로 나가면 숨김).

### 10. 프로젝트 숨김 · 소프트 삭제
- **삭제 = 소프트 삭제**(`deletedAt` 기록, 데이터 보존). **숨김 = `isArchived`**. 둘 다 **총관리자만** 실행.
- **숨김·삭제된 프로젝트는 총관리자만 열람.** 일반 유저의 목록·조회에서 제외.
- (업무 삭제는 여전히 **하드 삭제**·master — 프로젝트와 다름.)

### 11. 알림
- 앱 내 종 아이콘만. 트리거: 업무 삭제, 기한 임박(D-1)·지연, 초대·위임.
- **새 하위 업무 생성 시 master 알림** — 선택 공유(§9)를 새 가지로 확장할지 판단하도록. (이메일·푸시·심화는 백로그.)

---

## 6. 화면 · 라우트 (Next.js App Router)

```
/login                    로그인
/                         전체 프로젝트 대시보드 (요약 카드 + 프로젝트 목록)
/projects/[projectId]     프로젝트 업무 대시보드 (뷰 토글: 대시보드/상태그룹/캔버스)
/tasks                    전체 업무 뷰 (필터 + '내 업무' 프리셋)
```
- **업무 상세** = 드로어/모달(메모·코멘트·참여자·우선순위·파생·공유 관리).
- **비공개 업무 초대 UI = 서브트리 체크박스 트리 피커**: 해당 업무의 서브트리를 접기/펼치기 트리로 보여주고, 공유할 노드를 체크. 상단 프리셋 **`전체 공유` / `이 업무만`**. 각 체크 = `TaskParticipant` grant(`includeSubtree`) 저장.
- 모든 mutation은 **Server Actions**(또는 route handler) + §3 권한 + §9 접근 판정.

### 뷰 3종 (프로젝트 대시보드 토글)
- **대시보드(기본)**: 카드 그리드 + 정렬(§5.8).
- **상태 그룹 섹션**: `진행중→진행전→종료` 세로 접기/펼치기, 구획 제목에 개수. (칸반 대체 기본)
- **캔버스**: React Flow + dagre 자동 배치. 프로젝트별 기본, 전체 보기 옵션(프로젝트별 색).

---

## 7. 디자인 (중립·미니멀)

- 무채색 베이스 + 액센트 1색(블루). 상태 색: 진행중=블루 / 진행전=그레이 / 종료=그린 / 지연=레드 뱃지.
- 우선순위 점: 긴급=레드 / 높음=주황 / 보통=옅은 회색 / 낮음=연회색.
- 카드: 흰 배경, 0.5px 보더, radius 12px. **업무 카드=직사각형**, **프로젝트 카드=정사각형~4:3**.
- 반응형: **폰(~390) 2열 · 패드(~768) 3열 · PC(~1280) 사이드바+4열**. 업무 카드는 폰 2열에서 **압축형**.
- **PC 폭 축소 뷰 토글**: 컨테이너 `max-width` 프리셋(넓게/패드/폰).
- sans, 문장형 라벨, 볼드 남용 금지.

---

## 8. 빌드 순서 (Phase별 DoD)

**Phase 0 — 셋업**: Next.js(TS)+Tailwind+shadcn/ui+Prisma+Postgres, Vercel 파이프라인, Auth.js 로그인, `seed.ts`.
→ *DoD: 시드 유저 로그인 → 빈 대시보드, 로그아웃.*

**Phase 1 — 권한·프로젝트**: 프로젝트 CRUD, 공개/비공개, 멤버 초대, **숨김/소프트 삭제(총관리자, admin만 열람)**, 전체 대시보드+요약 카드.
→ *DoD: owner 생성·초대, 총관리자만 숨김/삭제·열람, 가시성 규칙.*

**Phase 2 — 업무 카드**: 업무 CRUD, 상태 3단계, 메모·기한, 참여/이탈, master·공개/비공개, **비공개 초대 트리 피커(§6)**, 지연 플래그, 코멘트, 하드 삭제('삭제' 입력+알림). 완료·연장=참여자.
→ *DoD: 참여→진행→완료 흐름, 지연 뱃지, 코멘트, 삭제 모달·알림, 트리 피커로 공유 범위 지정.*

**Phase 3 — 파생·캔버스·접근전파**: `parentId` 트리, 다중 파생, 부모 변경 시 서브트리 이동, 삭제 시 자식 끌어올리기, **§9 접근 판정(조상 walk, 동적 노드 자동 판정, 선택 공유 조합)**, React Flow+dagre.
→ *DoD: 다중 파생 캔버스 렌더, 나중 생긴 노드 접근 자동 판정, 선택 공유·차단 정확.*

**Phase 4 — 뷰·필터·우선순위**: 전체 업무 뷰, 다중 필터, '내 업무' 프리셋, 참여자별 우선순위, 정렬(§5.8), 상태 그룹 섹션 뷰, PC 폭 토글.
→ *DoD: 필터·정렬·우선순위·상태 그룹 동작.*

**Phase 5 — 확장(선택)**: 컬럼형 칸반(PC 전용), 공유 '제외' 토글(전체 공유 후 특정 가지 빼기), 알림 심화, 태그.

---

## 9. 범위 밖 (Non-goals, MVP)

파일 첨부 · 실시간 동시 동기화 · 이메일/푸시 알림 · GitHub 연동 · 활동 히스토리 · 자유 가입 · 계정 관리 UI · 컬럼형 칸반 · 공유 제외 토글(Phase 5).

---

## 10. 환경 변수

```
DATABASE_URL=postgresql://...
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=http://localhost:3000
```

---

## 11. 상태

- ✅ 전 항목 확정. **미확정 `⚠️ 가정` 없음.**
- 핸드오프: 이 파일을 저장소 루트에 두고 "`BUILD-ORDER-claude-code-v3.md`대로 Phase 0부터 시작"으로 지시.
