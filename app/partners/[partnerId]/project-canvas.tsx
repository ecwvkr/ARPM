"use client";

import { useCallback, useEffect, useState } from "react";
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
import { getAllCanvasProjects, getCanvasProjects, moveProject, updateProjectPosition } from "@/app/actions/projects";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, isOverdue } from "@/lib/priority";
import { ProjectDetail } from "./project-detail";

type CanvasProject = {
  id: string;
  parentId: string | null;
  partnerId: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  visibility: "PUBLIC" | "PRIVATE";
  dueDate: Date | null;
  canvasX: number | null;
  canvasY: number | null;
};

type CanvasPartner = { id: string; name: string; color: string | null };

const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;
const PARTNER_NODE_HEIGHT = 44;

// partners가 있으면 "전체 뷰"(파트너 노드를 루트로 각 프로젝트를 매단다), 없으면 단일 파트너 뷰.
function buildGraph(
  projects: CanvasProject[],
  partners: CanvasPartner[] | null,
  onOpen: (id: string) => void,
  color: string | null,
) {
  const colorByPartner = new Map((partners ?? []).map((p) => [p.id, p.color]));
  const colorOf = (t: CanvasProject) =>
    partners ? (colorByPartner.get(t.partnerId) ?? null) : color;

  const links: [string, string][] = [];
  for (const t of projects) {
    if (t.parentId) links.push([t.parentId, t.id]);
    else if (partners) links.push([`partner:${t.partnerId}`, t.id]);
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 56 });
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
        data: { partner: p },
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
        data: { project: t, onOpen, color: colorOf(t) },
      };
    }),
  ];

  const edges: Edge[] = links.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
    markerEnd: { type: MarkerType.ArrowClosed },
    ...(source.startsWith("partner:") ? { style: { strokeDasharray: "4 4" } } : {}),
  }));

  return { nodes, edges };
}

function PartnerNode({ data }: NodeProps<Node<{ partner: CanvasPartner }>>) {
  const { partner } = data;
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="rounded-2xl bg-muted px-3 py-2 shadow-md ring-1 ring-foreground/10"
    >
      <Link href={`/partners/${partner.id}`} className="flex items-center gap-1.5 text-sm font-bold">
        {partner.color && (
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: partner.color }} />
        )}
        <span className="truncate">{partner.name}</span>
      </Link>
      <Handle type="source" position={Position.Bottom} className="!size-3.5 !border-2 !border-background !bg-primary" />
    </div>
  );
}

function CanvasNode({
  data,
}: NodeProps<Node<{ project: CanvasProject; onOpen: (id: string) => void; color: string | null }>>) {
  const { project, onOpen, color } = data;
  const overdue = isOverdue(project.dueDate, project.status);

  return (
    <div
      onClick={() => onOpen(project.id)}
      style={{ width: NODE_WIDTH, ...(color ? { borderLeftColor: color } : {}) }}
      className={`cursor-pointer rounded-2xl bg-card px-3 py-2 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10 ${
        color ? "border-l-4" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!size-3.5 !border-2 !border-background !bg-primary" />
      <p className="truncate text-sm font-medium">{project.title}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge variant={project.status === "DONE" ? "secondary" : "default"}>
          {STATUS_LABEL[project.status]}
        </Badge>
        {overdue && <Badge variant="destructive">지연</Badge>}
        <Badge variant={project.visibility === "PUBLIC" ? "secondary" : "outline"}>
          {project.visibility === "PUBLIC" ? "공개" : "비공개"}
        </Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-3.5 !border-2 !border-background !bg-primary" />
    </div>
  );
}

const nodeTypes = { project: CanvasNode, partner: PartnerNode };

export function ProjectCanvas(props: {
  partnerId?: string | null;
  className?: string;
  color?: string | null;
}) {
  return (
    <ReactFlowProvider>
      <ProjectCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function ProjectCanvasInner({
  partnerId = null,
  className = "h-[600px]",
  color = null,
}: {
  partnerId?: string | null;
  className?: string;
  color?: string | null;
}) {
  const [projects, setProjects] = useState<CanvasProject[] | null>(null);
  const [partners, setPartners] = useState<CanvasPartner[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
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

  useEffect(() => {
    if (!projects) return;
    const { nodes, edges } = buildGraph(projects, partners, setSelected, color);
    setNodes(nodes);
    setEdges(edges);
    // ponytail: fitView은 노드가 실제로 측정(ResizeObserver)된 다음에야 정확히 계산되므로
    // rAF 한 틱으로는 부족할 때가 있어 짧은 지연을 둔다.
    const id = setTimeout(() => fitView(), 50);
    return () => clearTimeout(id);
  }, [projects, partners, setNodes, setEdges, fitView, color]);

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
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
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
