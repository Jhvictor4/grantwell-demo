import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Eye,
  FileText,
  CheckSquare,
  ShieldCheck,
  DollarSign,
  FolderOpen,
  BarChart3,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Award,
  Flag,
  Paperclip
} from 'lucide-react';
import { getVisibleTabsFromContext } from '@/lib/role-based-ui';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  status?: 'completed' | 'in-progress' | 'overdue' | 'pending';
  disabled?: boolean;
}

interface GrantWorkspaceNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: string;
  grantRole?: string;
  grantId?: string;
  isOwner?: boolean;
  grantStatus?: string;
}

export function GrantWorkspaceNavigation({ 
  activeTab, 
  onTabChange, 
  userRole, 
  grantRole,
  grantId,
  isOwner = false,
  grantStatus
}: GrantWorkspaceNavigationProps) {
  const systemRole = userRole as any;
  const gRole = grantRole as any;

  const demoMode = import.meta.env?.VITE_DEMO_MODE === 'true';

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'eye': Eye,
    'file-text': FileText,
    'shield-check': ShieldCheck,
    'dollar-sign': DollarSign,
    'check-square': CheckSquare,
    'paperclip': Paperclip,
    'users': Users,
    'flag': Flag,
    'award': Award,
  };

  const tabs = getVisibleTabsFromContext({ systemRole, grantRole: gRole, isOwner, grantStatus }).map(t => ({
    id: t.id,
    label: t.label,
    Icon: iconMap[t.icon] || Eye,
    disabled: t.id === 'closeout' && grantStatus === 'draft'
  }));

  const getTabStatus = (tabId: string) => {
    if (!(demoMode && systemRole === 'admin')) return undefined;
    const statuses: Record<string, 'completed' | 'in-progress' | 'overdue' | 'pending'> = {
      overview: 'completed',
      narrative: 'in-progress',
      tasks: 'pending',
      compliance: 'overdue',
      budget: 'completed',
      documents: 'pending',
      closeout: 'pending',
      team: 'completed'
    };
    return statuses[tabId];
  };

  const getStatusBadge = (status?: 'completed' | 'in-progress' | 'overdue' | 'pending') => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">Complete</Badge>;
      case 'in-progress':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">In Progress</Badge>;
      case 'overdue':
        return <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">Overdue</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-slate-100 text-slate-800 text-xs">Pending</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="border-b bg-card sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Status = getStatusBadge(getTabStatus(tab.id));
            const Icon = tab.Icon;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-none border-b-2 border-transparent whitespace-nowrap relative",
                  activeTab === tab.id && "border-primary text-primary bg-transparent",
                  tab.disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => !tab.disabled && onTabChange(tab.id)}
                disabled={tab.disabled}
                title={tab.disabled ? "Closeout is available for non-draft grants." : undefined}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {Status && (
                  <span data-testid="workspace-status-chips" className="ml-2">{Status}</span>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}