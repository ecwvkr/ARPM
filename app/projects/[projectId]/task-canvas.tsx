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
import { getAllCanvasTasks, getCanvasTasks, moveTask, updateTaskPosition } from "@/app/actions/tasks";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, isOverdue } from "@/lib/priority";
import { TaskDetail } from "./task-detail";

type CanvasTask = {
  id: string;
  parentId: string | null;
  projectId: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  visibility: "PUBLIC" | "PRIVATE";
  dueDate: Date | null;
  canvasX: number | null;
  canvasY: number | null;
};

type CanvasProject = { id: string; name: string; color: string | null };

const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;
const PROJECT_NODE_HEIGHT = 44;

// projects가 있으면 "전체 뷰"(프로젝트 노드를 루트로 각 업무를 매단다), 없으면 단일 프로젝트 뷰.
function buildGraph(
  tasks: CanvasTask[],
  projects: CanvasProject[] | null,
  onOpen: (id: string) => void,
  color: string | null,
) {
  const colorByProject = new Map((projects ?? []).map((p) => [p.id, p.color]));
  const colorOf = (t: CanvasTask) =>
    projects ? (colorByProject.get(t.projectId) ?? null) : color;

  const links: [string, string][] = [];
  for (const t of tasks) {
    if (t.parentId) links.push([t.parentId, t.id]);
    else if (projects) links.push([`project:${t.projectId}`, t.id]);
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 56 });
  for (const p of projects ?? []) {
    g.setNode(`project:${p.id}`, { width: NODE_WIDTH, height: PROJECT_NODE_HEIGHT });
  }
  for (const t of tasks) g.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const [source, target] of links) g.setEdge(source, target);
  dagre.layout(g);

  const nodes: Node[] = [
    ...(projects ?? []).map((p) => {
      const pos = g.node(`project:${p.id}`);
      return {
        id: `project:${p.id}`,
        type: "project",
        position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - PROJECT_NODE_HEIGHT / 2 },
        data: { project: p },
        draggable: false,
      };
    }),
    ...tasks.map((t) => {
      const pos = g.node(t.id);
      const position =
        t.canvasX !== null && t.canvasY !== null
          ? { x: t.canvasX, y: t.canvasY }
          : { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 };
      return {
        id: t.id,
        type: "task",
        position,
        data: { task: t, onOpen, color: colorOf(t) },
      };
    }),
  ];

  const edges: Edge[] = links.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
    markerEnd: { type: MarkerType.ArrowClosed },
    ...(source.startsWith("project:") ? { style: { strokeDasharray: "4 4" } } : {}),
  }));

  return { nodes, edges };
}

function ProjectNode({ data }: NodeProps<Node<{ project: CanvasProject }>>) {
  const { project } = data;
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="rounded-2xl bg-muted px-3 py-2 shadow-md ring-1 ring-foreground/10"
    >
      <Link href={`/projects/${project.id}`} className="flex items-center gap-1.5 text-sm font-bold">
        {project.color && (
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
        )}
        <span className="truncate">{project.name}</span>
      </Link>
      <Handle type="source" position={Position.Bottom} className="!size-3.5 !border-2 !border-background !bg-primary" />
    </div>
  );
}

function CanvasNode({
  data,
}: NodeProps<Node<{ task: CanvasTask; onOpen: (id: string) => void; color: string | null }>>) {
  const { task, onOpen, color } = data;
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      onClick={() => onOpen(task.id)}
      style={{ width: NODE_WIDTH, ...(color ? { borderLeftColor: color } : {}) }}
      className={`cursor-pointer rounded-2xl bg-card px-3 py-2 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10 ${
        color ? "border-l-4" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!size-3.5 !border-2 !border-background !bg-primary" />
      <p className="truncate text-sm font-medium">{task.title}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge variant={task.status === "DONE" ? "secondary" : "default"}>
          {STATUS_LABEL[task.status]}
        </Badge>
        {overdue && <Badge variant="destructive">지연</Badge>}
        <Badge variant={task.visibility === "PUBLIC" ? "secondary" : "outline"}>
          {task.visibility === "PUBLIC" ? "공개" : "비공개"}
        </Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-3.5 !border-2 !border-background !bg-primary" />
    </div>
  );
}

const nodeTypes = { task: CanvasNode, project: ProjectNode };

export function TaskCanvas(props: {
  projectId?: string | null;
  className?: string;
  color?: string | null;
}) {
  return (
    <ReactFlowProvider>
      <TaskCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function TaskCanvasInner({
  projectId = null,
  className = "h-[600px]",
  color = null,
}: {
  projectId?: string | null;
  className?: string;
  color?: string | null;
}) {
  const [tasks, setTasks] = useState<CanvasTask[] | null>(null);
  const [projects, setProjects] = useState<CanvasProject[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  // 전체 뷰는 여러 프로젝트에 걸쳐 있어 좌표 저장·부모 연결을 적용할 대상이 모호하므로 읽기 전용.
  const readOnly = !projectId;

  const reload = useCallback(() => {
    if (projectId) {
      getCanvasTasks(projectId).then((t) => setTasks(t as CanvasTask[]));
    } else {
      getAllCanvasTasks().then((r) => {
        setProjects(r.projects);
        setTasks(r.tasks as CanvasTask[]);
      });
    }
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!tasks) return;
    const { nodes, edges } = buildGraph(tasks, projects, setSelected, color);
    setNodes(nodes);
    setEdges(edges);
    // ponytail: fitView은 노드가 실제로 측정(ResizeObserver)된 다음에야 정확히 계산되므로
    // rAF 한 틱으로는 부족할 때가 있어 짧은 지연을 둔다.
    const id = setTimeout(() => fitView(), 50);
    return () => clearTimeout(id);
  }, [tasks, projects, setNodes, setEdges, fitView, color]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      const formData = new FormData();
      formData.set("parentId", connection.source);
      try {
        await moveTask(connection.target, formData);
      } catch (err) {
        alert(err instanceof Error ? err.message : "연결할 수 없습니다.");
      }
      reload();
    },
    [reload],
  );

  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    updateTaskPosition(node.id, node.position.x, node.position.y);
  }, []);

  if (!tasks) return <p className="text-sm text-muted-foreground">불러오는 중...</p>;
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">아직 업무가 없습니다.</p>;

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
            <DialogTitle>업무 상세</DialogTitle>
          </DialogHeader>
          {selected && (
            <TaskDetail
              taskId={selected}
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
