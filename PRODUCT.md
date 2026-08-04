# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A small trusted team (tentative team name "All Rounders") who will actually use this tool for their own real project and task work — not a demo or portfolio piece. No public signup: accounts are issued directly in the database by an admin. Roles:

- **총관리자 (superadmin)** — platform-wide moderator; only one who can archive/hide or soft-delete projects, and the only one who can view hidden/deleted projects.
- **Project owner** — creates a project, invites members, sets its public/private visibility.
- **Project member / task participant** — works on tasks inside projects they belong to or have been granted access to.
- **Task master** — the owner of a specific task; can edit it, set its visibility, invite participants with scoped sharing, delegate master, or hard-delete it.

The seeded demo accounts (총관리자/admin, 김민수, 이서연 in `prisma/seed.ts`) stand in for real teammates who will use these accounts day to day, not throwaway test fixtures.

## Product Purpose

A project/task management tool for a small trusted team to share and track work, built around one thing generic PM tools don't model: work that **derives** from other work (a task branching into sub-tasks, arbitrarily deep), and **private sharing that follows that branching structure automatically**.

Success looks like: team members always see what's due or overdue across their projects, a task master can share a private task with exactly the right people — including people who should also see whatever sub-tasks get created under it later, without manually re-granting access — and the superadmin can retire a project without ever losing its data.

## Positioning

Two mechanisms a generic Trello/Asana-style board does not offer:

1. **Task derivation as a first-class graph.** Tasks form an unlimited-depth parent→child tree ("파생"), rendered as an interactive canvas (React Flow + dagre) alongside list/kanban/status-group views — the lineage of how work branched is visible, not just a flat backlog.
2. **Read-time, self-propagating private sharing.** Access to a private task is computed on read from an ancestor-walk (nearest granting ancestor wins), not stored per node. Granting `includeSubtree=true` on a node means every task created under it later — even far in the future — is automatically visible to that person with no re-sharing step. A branch can also be selectively carved back out of a broader grant. Moving a task to a new parent re-evaluates its visibility from its new position.

## Operating Context

- Korean-language UI; team communicates and works in Korean.
- Invite-only accounts, provisioned directly in the DB — there is deliberately no signup UI or account-management screen.
- One superadmin moderates project lifecycle (hide/soft-delete); soft-deleted and hidden projects stay queryable only by the superadmin, never by regular members.
- Project owners manage membership and visibility; task masters manage everything at the task level (visibility, sharing scope, delegation, hard delete).
- Used on both desktop and mobile in real usage — desktop has a 3-step width toggle (넓게/패드/폰) for the PC layout, mobile has a persistent bottom navigation bar.
- Deployed on Vercel; Postgres via Supabase; source at github.com/ecwvkr/ARPM.

## Capabilities and Constraints

- No self-signup, no OAuth, no account-management UI — accounts exist only via direct DB seeding. This is a deliberate MVP boundary, not a gap to close.
- Explicit non-goals (current scope): file attachments, real-time multi-user sync, email/push notifications, GitHub integration, activity history log.
- Private-task visibility is computed at read time via an ancestor walk on every render (list, all-tasks view, canvas) — it must stay correct as the tree grows or tasks are reparented, since nothing is cached/stored.
- Terminology to preserve: **파생** (derive) = create a child task under a parent; **master** = the owning/delegatable role on a single task; **참여자** (participant) = has access to and can act on a task, whether invited directly or via inherited subtree access; **총관리자** (superadmin) = the one platform-wide moderator role, distinct from a project owner.
- Completed tasks (`완료하기`) freeze their participant list — no further join/leave once done.
- Deleting a task is a hard delete but promotes its children to its own parent rather than cascading; deleting/hiding a project is always soft (data preserved), and is superadmin-only.

## Brand Commitments

- Name: **AR_PM** — "AR" from the team's (tentative, may still change) name "All Rounders"; "PM" for Project Management.
- App identity assets are already in place: favicon, apple touch icon, and PWA manifest icons (`app/icon.svg`, `app/apple-icon.png`, `public/icon-512.png`), theme color `#2563eb`.
- UI voice: Korean, sentence-style labels, minimal bold usage — a durable content constraint carried over from the original build spec (visual system details themselves belong in DESIGN.md, not here).

## Evidence on Hand

- Seeded accounts represent real teammates: 총관리자(admin, superadmin), 김민수, 이서연 (`prisma/seed.ts`).
- A working demo project ("웹사이트 리뉴얼") with a real multi-level task tree (배포 준비, 테스트, QA 테스트 → 테스트케이스 작성 → 회귀 테스트 케이스, 성능 테스트) exists and was used to validate the sharing/derivation logic end-to-end.
- No customer testimonials, case studies, pricing, or usage-scale claims exist yet — none should be invented for marketing-style copy.

## Product Principles

1. Trust the team, minimize friction — no approval gates on everyday actions (join, leave, comment) once access is granted; the only gate is who gets access in the first place.
2. Access is computed, not configured per node — sharing must keep working correctly as the tree grows or is reorganized, without anyone having to revisit every existing node.
3. History is preserved, not just hidden — soft-delete over hard-delete for projects, child-promotion over cascade-delete for tasks, frozen participant snapshots on completion.
4. Structure is the product — the derivation tree/canvas is the reason this tool exists over a generic board; every other view (list, kanban, status groups) is a different lens on the same tree.
5. Korean-first, small-team scale — build and write for a handful of trusted coworkers, not a multi-tenant SaaS audience.
