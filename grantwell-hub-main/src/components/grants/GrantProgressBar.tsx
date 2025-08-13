import React from 'react';
import { Progress } from '@/components/ui/progress';
import { useGrantProgress } from '@/hooks/useGrantProgress';
import { CheckCircle, Clock } from 'lucide-react';

interface GrantProgressBarProps {
  grantId: string;
  showDetails?: boolean;
}

export function GrantProgressBar({ grantId, showDetails = false }: GrantProgressBarProps) {
  const { progress, loading, getOverallProgress } = useGrantProgress(grantId);

  if (loading || !progress) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Grant Progress</span>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
        <Progress value={0} className="h-2" />
      </div>
    );
  }

  const overallProgress = getOverallProgress();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">Grant Readiness</span>
        </div>
        <span className="text-sm font-semibold text-green-600">
          {overallProgress}%
        </span>
      </div>
      
      <Progress value={overallProgress} className="h-3" />
    </div>
  );
}