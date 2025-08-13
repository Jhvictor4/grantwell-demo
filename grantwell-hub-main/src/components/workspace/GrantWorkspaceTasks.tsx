import React from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import { SystemRole, GrantRole } from '@/lib/permissions';

interface GrantWorkspaceTasksProps {
  grantId: string;
  userRole: SystemRole;
  grantRole?: GrantRole;
  isOwner?: boolean;
}

export function GrantWorkspaceTasks({ grantId }: GrantWorkspaceTasksProps) {
  // The global Kanban board is reused here, scoped to this grant for 1:1 parity
  return <KanbanBoard grantId={grantId} />;
}
