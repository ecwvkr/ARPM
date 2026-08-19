"use client";

import { useEffect, useState, useTransition } from "react";
import { getProjectDetail, updateProjectVisibility } from "@/app/actions/projects";
import { buildParticipantChips } from "@/lib/priority";
import { SectionCard } from "@/components/ui/section-card";
import { DeleteDialog } from "./project-delete-dialog";
import { Button } from "@/components/ui/button";
import { ProjectDetailHeader } from "./project-detail-header";
import { ProjectDetailStatus } from "./project-detail-status";
import { ProjectDetailParticipants } from "./project-detail-participants";
import { ProjectDetailTasks } from "./project-detail-tasks";
import { ProjectDetailComments } from "./project-detail-comments";
import { useSavedToast } from "@/components/ui/saved-toast";
import { IconArchive } from "@tabler/icons-react";

type Detail = Awaited<ReturnType<typeof getProjectDetail>>;

export function ProjectDetail({ projectId, onDeleted }: { projectId: string; onDeleted: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast, trigger: showSavedToast } = useSavedToast();

  const reload = () => {
    startTransition(async () => {
      setDetail(await getProjectDetail(projectId));
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (detail === null) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">불러오는 중...</p>;
  }

  if (!detail.project) {
    return (
      <p className="px-1 py-4 text-sm text-muted-foreground">
        프로젝트를 찾을 수 없거나 접근 권한이 없습니다.
      </p>
    );
  }

  const {
    project,
    canManage,
    canParticipantAct,
    canComment,
    canJoin,
    canLeave,
    isViewer,
    currentUserId,
    isSuperAdmin,
    commentVisibleCount,
    isNew,
    isEdited,
    recentChanges,
  } = detail;
  const locked = project.completedAt !== null;
  const participantChips = buildParticipantChips(project);
  const mentionCandidates = [
    { userId: project.master.id, userName: project.master.name },
    ...project.participants.map((p) => ({ userId: p.userId, userName: p.user.name })),
  ].filter((c, i, arr) => arr.findIndex((x) => x.userId === c.userId) === i);

  return (
    <div className="space-y-4 px-1 pb-8">
      <SectionCard>
        <ProjectDetailHeader
          projectId={projectId}
          partnerId={project.partnerId}
          project={project}
          canManage={canManage}
          locked={locked}
          isViewer={isViewer}
          isNew={isNew}
          isEdited={isEdited}
          recentChanges={recentChanges}
          onSaved={reload}
        />
      </SectionCard>

      <SectionCard>
        <ProjectDetailStatus
          projectId={projectId}
          status={project.status}
          dueDate={project.dueDate}
          createdAt={project.createdAt}
          parentId={project.parentId}
          canParticipantAct={canParticipantAct}
          canManage={canManage}
          isSuperAdmin={isSuperAdmin}
          locked={locked}
          myPriority={project.priorities.find((p) => p.userId === currentUserId)?.level ?? "HOLD"}
          onDone={reload}
        />
      </SectionCard>

      <SectionCard title={`참여자 (${participantChips.length})`}>
        <ProjectDetailParticipants
          projectId={projectId}
          participantChips={participantChips}
          currentUserId={currentUserId}
          canManage={canManage}
          canJoin={canJoin}
          canLeave={canLeave}
          excludeIds={[project.master.id, ...project.participants.map((p) => p.userId)]}
          onDone={reload}
        />
      </SectionCard>

      <SectionCard title={`테스크 (${project.tasks.filter((t) => !t.done).length}/${project.tasks.length})`}>
        <ProjectDetailTasks
          projectId={projectId}
          tasks={project.tasks}
          canEdit={canParticipantAct && !locked}
          currentUserId={currentUserId}
          isMaster={canManage}
          participants={participantChips.map((p) => ({ userId: p.userId, userName: p.userName }))}
          onDone={reload}
        />
      </SectionCard>

      {canManage && (
        <SectionCard title="공개 범위">
          <select
            name="visibility"
            aria-label="공개 범위"
            defaultValue={project.visibility}
            disabled={isPending}
            onChange={(e) => {
              const formData = new FormData();
              formData.set("visibility", e.target.value);
              startTransition(async () => {
                await updateProjectVisibility(projectId, formData);
                reload();
                showSavedToast();
              });
            }}
            className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
          >
            <option value="PUBLIC">공개</option>
            <option value="PRIVATE">비공개</option>
          </select>
        </SectionCard>
      )}

      <SectionCard title={`코멘트 (${project.comments.length})`}>
        <ProjectDetailComments
          projectId={projectId}
          comments={project.comments}
          commentVisibleCount={commentVisibleCount}
          currentUserId={currentUserId}
          isSuperAdmin={isSuperAdmin}
          canComment={canComment}
          mentionCandidates={mentionCandidates}
          onDone={reload}
        />
      </SectionCard>

      {canManage && (
        <div className="flex justify-end">
          <DeleteDialog
            projectId={projectId}
            onDeleted={onDeleted}
            trigger={
              <Button size="sm" variant="destructive">
                <IconArchive className="size-4" />
                보관함으로 이동
              </Button>
            }
          />
        </div>
      )}
      {toast}
    </div>
  );
}
