"use client";

import { useEffect, useState } from "react";
import { getTaskSubtree } from "@/app/actions/tasks";
import { Checkbox } from "@/components/ui/checkbox";

type TreeNode = { id: string; title: string; children: TreeNode[] };
export type GrantState = Record<string, { checked: boolean; includeSubtree: boolean }>;

function Row({
  node,
  depth,
  state,
  onToggleChecked,
  onToggleSubtree,
}: {
  node: TreeNode;
  depth: number;
  state: GrantState;
  onToggleChecked: (id: string, checked: boolean) => void;
  onToggleSubtree: (id: string, includeSubtree: boolean) => void;
}) {
  const s = state[node.id] ?? { checked: false, includeSubtree: true };

  return (
    <div>
      <div className="flex items-center gap-2 py-1 text-sm" style={{ marginLeft: depth * 16 }}>
        <Checkbox checked={s.checked} onCheckedChange={(v) => onToggleChecked(node.id, v === true)} />
        <span className="flex-1">{node.title}</span>
        {s.checked && (
          <div className="flex gap-1.5 text-xs">
            <button
              type="button"
              className={s.includeSubtree ? "underline underline-offset-2" : "text-muted-foreground"}
              onClick={() => onToggleSubtree(node.id, true)}
            >
              하위 포함
            </button>
            <button
              type="button"
              className={!s.includeSubtree ? "underline underline-offset-2" : "text-muted-foreground"}
              onClick={() => onToggleSubtree(node.id, false)}
            >
              이 업무만
            </button>
          </div>
        )}
      </div>
      {node.children.map((c) => (
        <Row
          key={c.id}
          node={c}
          depth={depth + 1}
          state={state}
          onToggleChecked={onToggleChecked}
          onToggleSubtree={onToggleSubtree}
        />
      ))}
    </div>
  );
}

export function TaskTreePicker({
  rootTaskId,
  onChange,
}: {
  rootTaskId: string;
  onChange: (grants: { taskId: string; includeSubtree: boolean }[]) => void;
}) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [state, setState] = useState<GrantState>({});

  useEffect(() => {
    getTaskSubtree(rootTaskId).then((t) => {
      setTree(t);
      if (t) {
        const initial: GrantState = { [t.id]: { checked: true, includeSubtree: true } };
        setState(initial);
        onChange(toGrants(initial));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootTaskId]);

  function toGrants(s: GrantState) {
    return Object.entries(s)
      .filter(([, v]) => v.checked)
      .map(([taskId, v]) => ({ taskId, includeSubtree: v.includeSubtree }));
  }

  function update(next: GrantState) {
    setState(next);
    onChange(toGrants(next));
  }

  function applyPreset(includeSubtree: boolean) {
    if (!tree) return;
    update({ [tree.id]: { checked: true, includeSubtree } });
  }

  if (!tree) {
    return <p className="text-sm text-muted-foreground">불러오는 중...</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 text-xs">
        <button type="button" className="underline underline-offset-2" onClick={() => applyPreset(true)}>
          전체 공유
        </button>
        <button type="button" className="underline underline-offset-2" onClick={() => applyPreset(false)}>
          이 업무만
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        하위 노드를 체크 후 &apos;이 업무만&apos;로 지정하면 그 아래 가지는 접근에서 제외됩니다.
      </p>
      <div className="rounded-md border-[0.5px] p-2">
        <Row
          node={tree}
          depth={0}
          state={state}
          onToggleChecked={(id, checked) =>
            update({ ...state, [id]: { checked, includeSubtree: state[id]?.includeSubtree ?? true } })
          }
          onToggleSubtree={(id, includeSubtree) =>
            update({ ...state, [id]: { checked: true, includeSubtree } })
          }
        />
      </div>
    </div>
  );
}
