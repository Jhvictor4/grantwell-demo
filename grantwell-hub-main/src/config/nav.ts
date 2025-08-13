import { BarChart3, Target, FileText, PieChart, Calendar, CheckSquare, PenTool } from 'lucide-react';

export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  matchPaths?: string[];
}

export const mainNavItems: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: BarChart3, subtitle: 'Overview & stats', matchPaths: ['/'] },
  { title: 'Grants', url: '/grants', icon: Target, subtitle: 'Find & track opportunities', matchPaths: ['/grants'] },
  { title: 'Reports', url: '/reports', icon: FileText, subtitle: 'Budget, drawdowns & compliance', matchPaths: ['/reports'] },
  { title: 'Budget & Finance', url: '/budget-finance', icon: PieChart, subtitle: 'Budgets & utilization', matchPaths: ['/budget-finance'] },
  { title: 'Calendar', url: '/calendar', icon: Calendar, subtitle: 'Deadlines & events', matchPaths: ['/calendar'] },
  { title: 'Tasks', url: '/tasks', icon: CheckSquare, subtitle: 'Project management', matchPaths: ['/tasks'] },
  { title: 'Narrative Assistant', url: '/copilot', icon: PenTool, subtitle: 'AI grant writing help', matchPaths: ['/copilot'] },
];
