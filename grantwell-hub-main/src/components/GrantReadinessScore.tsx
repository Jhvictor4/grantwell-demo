import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';

interface GrantReadinessScoreProps {
  grantId: string;
  size?: 'sm' | 'md' | 'lg';
  refreshTrigger?: number;
}

export function GrantReadinessScore({ grantId, size = 'md', refreshTrigger = 0 }: GrantReadinessScoreProps) {
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState({
    narrative: false,
    budget: false,
    documents: false,
    approval: false
  });

  useEffect(() => {
    fetchReadinessScore();
  }, [grantId, refreshTrigger]);

  const fetchReadinessScore = async () => {
    try {
      setLoading(true);
      
      // Use the enhanced readiness score function from the database
      const { data: scoreData, error: scoreError } = await supabase
        .rpc('calculate_grant_readiness_score_enhanced', { p_grant_id: grantId });

      if (scoreError) {
        console.error('Error calculating readiness score:', scoreError);
        setScore(0);
        setLoading(false);
        return;
      }

      const calculatedScore = scoreData || 0;

      // Also get tasks for breakdown display
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('title, status')
        .eq('grant_id', grantId);

      if (!allTasks || allTasks.length === 0) {
        setScore(0);
        setBreakdown({ narrative: false, budget: false, documents: false, approval: false });
        return;
      }

      // Set the calculated score from the database function
      setScore(calculatedScore);

      // Calculate breakdown for tooltip display
      const categoryKeywords = {
        narrative: ['narrative', 'report', 'documentation', 'quarterly', 'proposal', 'story'],
        budget: ['budget', 'financial', 'vendor', 'cost', 'expense', 'funding'],
        documents: ['document', 'upload', 'file', 'attachment', 'form'],
        approval: ['approval', 'review', 'compliance', 'audit', 'sign', 'authorize']
      };

      const newBreakdown = {
        narrative: false,
        budget: false,
        documents: false,
        approval: false
      };

      Object.entries(categoryKeywords).forEach(([category, keywords]) => {
        const categoryTasks = allTasks.filter(task => 
          keywords.some(keyword => task.title.toLowerCase().includes(keyword))
        );
        
        if (categoryTasks.length > 0) {
          const categoryCompleted = categoryTasks.filter(t => t.status === 'completed').length;
          
          // Mark as complete if all tasks in category are completed
          newBreakdown[category as keyof typeof newBreakdown] = categoryCompleted > 0;
        }
      });

      setBreakdown(newBreakdown);
    } catch (error) {
      console.error('Error fetching readiness score:', error);
      setScore(0);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 40) return 'text-destructive';
    if (score <= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (score: number) => {
    if (score <= 40) return 'bg-destructive';
    if (score <= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getCheckmark = (completed: boolean) => completed ? '✓' : '✗';

  const progressHeight = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3';
  const badgeSize = size === 'sm' ? 'text-xs px-1' : size === 'lg' ? 'text-sm px-3' : 'text-xs px-2';

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-full ${progressHeight} bg-muted rounded-full animate-pulse`} />
        <div className="w-12 h-6 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1">
              <Progress 
                value={score} 
                className={`${progressHeight} bg-muted`}
                style={{
                  // @ts-ignore - Custom CSS property for progress color
                  '--progress-background': getProgressColor(score)
                }}
              />
            </div>
            <Badge 
              variant="outline" 
              className={`${badgeSize} ${getScoreColor(score)} font-medium shrink-0`}
            >
              {score}%
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-3">
          <div className="text-sm">
            <div className="font-medium mb-2">{score}% Ready - Based on:</div>
            <div className="space-y-1 text-xs">
              <div>[{getCheckmark(breakdown.narrative)}] Narrative Complete</div>
              <div>[{getCheckmark(breakdown.budget)}] Budget Complete</div>
              <div>[{getCheckmark(breakdown.documents)}] Documents Uploaded</div>
              <div>[{getCheckmark(breakdown.approval)}] Internal Approval</div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}