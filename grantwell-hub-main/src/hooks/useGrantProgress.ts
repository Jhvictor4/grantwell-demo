import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GrantProgress {
  overview_complete: boolean;
  narrative_complete: boolean;
  compliance_complete: boolean;
  budget_complete: boolean;
  tasks_complete: boolean;
  attachments_complete: boolean;
  closeout_complete: boolean;
}

const defaultProgress: GrantProgress = {
  overview_complete: false,
  narrative_complete: false,
  compliance_complete: false,
  budget_complete: false,
  tasks_complete: false,
  attachments_complete: false,
  closeout_complete: false,
};

export function useGrantProgress(grantId: string) {
  const [progress, setProgress] = useState<GrantProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('grant_progress')
          .select('overview_complete,narrative_complete,compliance_complete,budget_complete,tasks_complete,attachments_complete,closeout_complete')
          .eq('grant_id', grantId)
          .maybeSingle();
        if (error) throw error;
        if (!isMounted) return;
        setProgress(data ?? defaultProgress);
      } catch (err) {
        console.error('Failed to load grant progress', err);
        if (isMounted) setProgress(defaultProgress);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (grantId) load();
    return () => {
      isMounted = false;
    };
  }, [grantId]);

  const getOverallProgress = (): number => {
    if (!progress) return 0;
    const sections = Object.values(progress);
    const completed = sections.filter(Boolean).length;
    return Math.round((completed / sections.length) * 100);
  };

  return { progress, loading, getOverallProgress };
}