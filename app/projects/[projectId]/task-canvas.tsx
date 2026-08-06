"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { getCanvasTasks, moveTask } from "@/app/actions/tasks";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, isOverdue } from "@/lib/priority";
import { TaskDetail } from "./task-detail";

type CanvasTask = {
  id: string;
  parentId: string | null;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  visibility: "PUBLIC" | "PRIVATE";
  dueDate: Date | null;
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;

function layout(tasks: CanvasTask[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 56 });
  tasks.forEach((t) => g.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  tasks.forEach((t) => {
    if (t.parentId) g.setEdge(t.parentId, t.id);
  });
  dagre.layout(g);
  return new Map(tasks.map((t) => [t.id, g.node(t.id)]));
}

function buildGraph(tasks: CanvasTask[], onOpen: (id: string) => void) {
  const positions = layout(tasks);
  const nodes: Node[] = tasks.map((t) => {
    const pos = positions.get(t.id)!;
    return {
      id: t.id,
      type: "task",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { task: t, onOpen },
    };
  });
  const edges: Edge[] = tasks
    .filter((t) => t.parentId)
    .map((t) => ({
      id: `${t.parentId}-${t.id}`,
      source: t.parentId!,
      target: t.id,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
  return { nodes, edges };
}

function CanvasNode({ data }: NodeProps<Node<{ task: CanvasTask; onOpen: (id: string) => void }>>) {
  const { task, onOpen } = data;
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      onClick={() => onOpen(task.id)}
      className="cursor-pointer rounded-2xl bg-card px-3 py-2 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10"
      style={{ width: NODE_WIDTH }}
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

const nodeTypes = { task: CanvasNode };

export function TaskCanvas({ projectId, className = "h-[600px]" }: { projectId: string; className?: string }) {
  const [tasks, setTasks] = useState<CanvasTask[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const reload = useCallback(() => {
    getCanvasTasks(projectId).then((t) => setTasks(t as CanvasTask[]));
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!tasks) return;
    const { nodes, edges } = buildGraph(tasks, setSelected);
    setNodes(nodes);
    setEdges(edges);
  }, [tasks, setNodes, setEdges]);

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
        onConnect={onConnect}
        connectionRadius={40}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>

      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            reload();
          }
        }}
      >
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>업무 상세</SheetTitle>
          </SheetHeader>
          {selected && (
            <TaskDetail
              taskId={selected}
              onDeleted={() => {
                setSelected(null);
                reload();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
