"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import {
  getAllCanvasProjects,
  getCanvasProjects,
  moveProject,
  updateProjectPosition,
  createProject,
  deriveProject,
  renameProject,
} from "@/app/actions/projects";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { isOverdue } from "@/lib/priority";
import { ProjectDetail } from "./project-detail";
import { IconMinus, IconPlus, IconCalendar } from "@tabler/icons-react";

type CanvasProject = {
  id: string;
  parentId: string | null;
  masterId: string;
  partnerId: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  visibility: "PUBLIC" | "PRIVATE";
  dueDate: Date | null;
  canvasX: number | null;
  canvasY: number | null;
  participants: { userId: string; name: string }[];
};

type CanvasPartner = { id: string; name: string; color: string | null };

const NODE_WIDTH = 216;
const NODE_HEIGHT = 104; // 마감일/아바타 행이 추가돼 기존(72)보다 커졌다 — dagre 배치 간격도 이 값을 쓴다.
const PARTNER_NODE_HEIGHT = 44;

// 접힌 노드(프로젝트 id 또는 `partner:id`)의 하위를 전부 숨긴다.
function hiddenDescendants(projects: CanvasProject[], collapsed: Set<string>): Set<string> {
  const childrenByKey = new Map<string, CanvasProject[]>();
  for (const p of projects) {
    const key = p.parentId ?? `partner:${p.partnerId}`;
    const list = childrenByKey.get(key) ?? [];
    list.push(p);
    childrenByKey.set(key, list);
  }
  const hidden = new Set<string>();
  function hide(key: string) {
    for (const child of childrenByKey.get(key) ?? []) {
      if (!hidden.has(child.id)) {
        hidden.add(child.id);
        hide(child.id);
      }
    }
  }
  for (const key of collapsed) hide(key);
  return hidden;
}

// partners가 있으면 "전체 뷰"(파트너 노드를 루트로 각 프로젝트를 매단다), 없으면 단일 파트너 뷰.
function buildGraph(
  allProjects: CanvasProject[],
  partners: CanvasPartner[] | null,
  collapsed: Set<string>,
  handlers: {
    onOpen: (id: string) => void;
    onReload: () => void;
    onToggleCollapse: (key: string) => void;
    readOnly: boolean;
  },
) {
  const colorByPartner = new Map((partners ?? []).map((p) => [p.id, p.color]));
  const hidden = hiddenDescendants(allProjects, collapsed);
  const projects = allProjects.filter((p) => !hidden.has(p.id));

  const childCount = new Map<string, number>();
  for (const p of allProjects) {
    const key = p.parentId ?? `partner:${p.partnerId}`;
    childCount.set(key, (childCount.get(key) ?? 0) + 1);
  }

  const links: [string, string][] = [];
  for (const t of projects) {
    if (t.parentId) links.push([t.parentId, t.id]);
    else if (partners) links.push([`partner:${t.partnerId}`, t.id]);
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 64 });
  for (const p of partners ?? []) {
    g.setNode(`partner:${p.id}`, { width: NODE_WIDTH, height: PARTNER_NODE_HEIGHT });
  }
  for (const t of projects) g.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const [source, target] of links) g.setEdge(source, target);
  dagre.layout(g);

  const nodes: Node[] = [
    ...(partners ?? []).map((p) => {
      const pos = g.node(`partner:${p.id}`);
      return {
        id: `partner:${p.id}`,
        type: "partner",
        position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - PARTNER_NODE_HEIGHT / 2 },
        data: {
          partner: p,
          hasChildren: (childCount.get(`partner:${p.id}`) ?? 0) > 0,
          collapsed: collapsed.has(`partner:${p.id}`),
          onToggleCollapse: handlers.onToggleCollapse,
          onReload: handlers.onReload,
          readOnly: handlers.readOnly,
        },
        draggable: false,
      };
    }),
    ...projects.map((t) => {
      const pos = g.node(t.id);
      const position =
        t.canvasX !== null && t.canvasY !== null
          ? { x: t.canvasX, y: t.canvasY }
          : { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 };
      return {
        id: t.id,
        type: "project",
        position,
        data: {
          project: t,
          color: colorByPartner.get(t.partnerId) ?? null,
          hasChildren: (childCount.get(t.id) ?? 0) > 0,
          collapsed: collapsed.has(t.id),
          onOpen: handlers.onOpen,
          onReload: handlers.onReload,
          onToggleCollapse: handlers.onToggleCollapse,
          readOnly: handlers.readOnly,
        },
      };
    }),
  ];

  const edges: Edge[] = links.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
    markerEnd: { type: MarkerType.ArrowClosed },
    deletable: !source.startsWith("partner:"),
    ...(source.startsWith("partner:") ? { style: { strokeDasharray: "4 4" } } : {}),
  }));

  return { nodes, edges };
}

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title={collapsed ? "하위 펼치기" : "하위 접기"}
      aria-label={collapsed ? "하위 펼치기" : "하위 접기"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20"
    >
      {collapsed ? <IconPlus className="size-3" /> : <IconMinus className="size-3" />}
    </button>
  );
}

function AddChildButton({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      title="하위 프로젝트 추가"
      aria-label="하위 프로젝트 추가"
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      className="absolute -bottom-3 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
    >
      <IconPlus className="size-4" />
    </button>
  );
}

function PartnerNode({
  data,
}: NodeProps<
  Node<{
    partner: CanvasPartner;
    hasChildren: boolean;
    collapsed: boolean;
    onToggleCollapse: (key: string) => void;
    onReload: () => void;
    readOnly: boolean;
  }>
>) {
  const { partner, hasChildren, collapsed, onToggleCollapse, onReload, readOnly } = data;
  const [isPending, startTransition] = useTransition();

  return (
    <div
      style={{
        width: NODE_WIDTH,
        backgroundColor: partner.color ? `color-mix(in oklch, ${partner.color} 22%, var(--card))` : undefined,
      }}
      className="group relative rounded-2xl bg-muted px-3 py-2 shadow-md ring-1 ring-foreground/10"
    >
      <div className="flex items-center gap-1.5">
        {hasChildren && <CollapseToggle collapsed={collapsed} onToggle={() => onToggleCollapse(`partner:${partner.id}`)} />}
        <Link href={`/partners/${partner.id}`} className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-bold">
          {partner.color && (
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: partner.color }} />
          )}
          <span className="truncate">{partner.name}</span>
        </Link>
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-3.5 !border-2 !border-background !bg-primary" />
      {!readOnly && (
        <AddChildButton
          onAdd={() =>
            startTransition(async () => {
              const formData = new FormData();
              formData.set("partnerId", partner.id);
              formData.set("title", "새 프로젝트");
              await createProject(undefined, formData);
              onReload();
            })
          }
        />
      )}
      {isPending && <span className="sr-only">추가 중...</span>}
    </div>
  );
}

// 오늘 자정 기준 일수 차이 — 대시보드 dueLabel과 같은 방식(서버 로컬 자정 기준)으로 맞춘다.
function diffDaysFromToday(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function DueBadge({ dueDate, status }: { dueDate: Date; status: string }) {
  const overdue = isOverdue(dueDate, status);
  const diff = diffDaysFromToday(dueDate);
  const soon = !overdue && diff <= 1;
  const label = overdue ? `D+${Math.abs(diff)}` : diff === 0 ? "D-day" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  const formatted = `${String(dueDate.getMonth() + 1).padStart(2, "0")}.${String(dueDate.getDate()).padStart(2, "0")}`;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        overdue ? "text-destructive font-medium" : soon ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"
      }`}
    >
      <IconCalendar className="size-3" />
      {formatted} ({label})
    </span>
  );
}

function CanvasNode({
  data,
}: NodeProps<
  Node<{
    project: CanvasProject;
    color: string | null;
    hasChildren: boolean;
    collapsed: boolean;
    onOpen: (id: string) => void;
    onReload: () => void;
    onToggleCollapse: (key: string) => void;
    readOnly: boolean;
  }>
>) {
  const { project, color, hasChildren, collapsed, onOpen, onReload, onToggleCollapse, readOnly } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.title);
  const [isPending, startTransition] = useTransition();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = project.status === "DONE";
  const inProgress = project.status === "IN_PROGRESS";

  // 제목에 단일클릭(상세 열기)과 더블클릭(이름수정)이 같이 붙어 있으면 첫 클릭이
  // 곧장 상세를 열어버려 두번째 클릭이 dblclick으로 묶이지 못한다. 단일클릭을
  // 잠깐 미뤄뒀다가 그 사이 두번째 클릭이 오면 취소하고 편집 모드로 바꾼다.
  function handleTitleClick() {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      if (!readOnly) setEditing(true);
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onOpen(project.id);
    }, 250);
  }

  useEffect(() => {
    return () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    };
  }, []);

  function commitRename() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === project.title) {
      setDraft(project.title);
      return;
    }
    startTransition(async () => {
      try {
        await renameProject(project.id, trimmed);
        onReload();
      } catch {
        setDraft(project.title);
      }
    });
  }

  return (
    <div
      style={{
        width: NODE_WIDTH,
        ...(inProgress && color ? { borderLeftColor: color } : {}),
      }}
      className={`group relative rounded-2xl bg-card px-3 py-2 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10 ${
        inProgress && color ? "border-l-4" : ""
      } ${done ? "opacity-50" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!size-3.5 !border-2 !border-background !bg-primary" />

      <div className="flex items-start gap-1.5">
        {hasChildren && <CollapseToggle collapsed={collapsed} onToggle={() => onToggleCollapse(project.id)} />}
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(project.title);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={isPending}
            className="w-full min-w-0 flex-1 rounded border border-input bg-transparent px-1 text-sm outline-none"
          />
        ) : (
          <p
            onClick={handleTitleClick}
            className={`min-w-0 flex-1 cursor-pointer truncate text-sm font-medium ${done ? "line-through" : ""}`}
          >
            {project.title}
          </p>
        )}
      </div>

      <div onClick={() => onOpen(project.id)} className="mt-1.5 flex cursor-pointer items-center justify-between gap-1">
        {project.dueDate ? (
          <DueBadge dueDate={project.dueDate} status={project.status} />
        ) : (
          <span className="text-xs text-muted-foreground/60">마감일 없음</span>
        )}
        {project.participants.length > 0 && (
          <AvatarStack
            people={project.participants.map((p) => ({ id: p.userId, name: p.name }))}
            max={3}
            size="xs"
          />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!size-3.5 !border-2 !border-background !bg-primary" />
      {!readOnly && !done && (
        <AddChildButton
          onAdd={() =>
            startTransition(async () => {
              const formData = new FormData();
              formData.set("title", "새 프로젝트");
              await deriveProject(project.id, undefined, formData);
              onReload();
            })
          }
        />
      )}
    </div>
  );
}

const nodeTypes = { project: CanvasNode, partner: PartnerNode };

export function ProjectCanvas(props: { partnerId?: string | null; className?: string; color?: string | null }) {
  return (
    <ReactFlowProvider>
      <ProjectCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function ProjectCanvasInner({
  partnerId = null,
  className = "h-[600px]",
}: {
  partnerId?: string | null;
  className?: string;
  color?: string | null;
}) {
  const [projects, setProjects] = useState<CanvasProject[] | null>(null);
  const [partners, setPartners] = useState<CanvasPartner[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  // 전체 뷰는 여러 파트너에 걸쳐 있어 좌표 저장·부모 연결을 적용할 대상이 모호하므로 읽기 전용.
  const readOnly = !partnerId;

  const reload = useCallback(() => {
    if (partnerId) {
      getCanvasProjects(partnerId).then((t) => setProjects(t as CanvasProject[]));
    } else {
      getAllCanvasProjects().then((r) => {
        setPartners(r.partners);
        setProjects(r.projects as CanvasProject[]);
      });
    }
  }, [partnerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handlers = useMemo(
    () => ({ onOpen: setSelected, onReload: reload, onToggleCollapse: toggleCollapse, readOnly }),
    [reload, toggleCollapse, readOnly],
  );

  useEffect(() => {
    if (!projects) return;
    const { nodes, edges } = buildGraph(projects, partners, collapsed, handlers);
    setNodes(nodes);
    setEdges(edges);
    // ponytail: fitView은 노드가 실제로 측정(ResizeObserver)된 다음에야 정확히 계산되므로
    // rAF 한 틱으로는 부족할 때가 있어 짧은 지연을 둔다.
    const id = setTimeout(() => fitView(), 50);
    return () => clearTimeout(id);
  }, [projects, partners, collapsed, handlers, setNodes, setEdges, fitView]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      const formData = new FormData();
      formData.set("parentId", connection.source);
      try {
        await moveProject(connection.target, formData);
      } catch (err) {
        alert(err instanceof Error ? err.message : "연결할 수 없습니다.");
      }
      reload();
    },
    [reload],
  );

  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    updateProjectPosition(node.id, node.position.x, node.position.y);
  }, []);

  // 파트너→프로젝트 점선은 실제 연결이 아니라 "이 파트너 바로 아래"를 나타내는 표시일 뿐이라
  // 지울 게 없다(edges에서 deletable: false로 이미 막아뒀다). 프로젝트 간 선만 부모를 해제한다.
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const real = deleted.filter((e) => !e.source.startsWith("partner:"));
      if (real.length === 0) return;
      Promise.all(real.map((e) => moveProject(e.target, new FormData()))).then(reload);
    },
    [reload],
  );

  if (!projects) return <p className="text-sm text-muted-foreground">불러오는 중...</p>;
  if (projects.length === 0) return <p className="text-sm text-muted-foreground">아직 프로젝트가 없습니다.</p>;

  return (
    <div className={`${className} rounded-2xl bg-card shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
        onEdgesDelete={readOnly ? undefined : onEdgesDelete}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        deleteKeyCode={["Delete", "Backspace"]}
        connectionRadius={40}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            reload();
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>프로젝트 상세</DialogTitle>
          </DialogHeader>
          {selected && (
            <ProjectDetail
              projectId={selected}
              onDeleted={() => {
                setSelected(null);
                reload();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
