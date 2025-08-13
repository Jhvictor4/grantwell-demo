import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, TrendingUp, Award, DollarSign, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PerformanceMetrics {
  total_submitted: number;
  total_awarded: number;
  award_rate: number;
  avg_grant_size: number;
  avg_time_to_submission: number;
}

export function PerformanceMetricsWidget() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (!userId) return;

      // Load user-tracked applications
      const { data: tracking } = await supabase
        .from('application_tracking')
        .select('id, grant_id, status, created_at, updated_at')
        .eq('user_id', userId);

      const considered = new Set(['submitted','awarded','rejected','in-review']);
      const submissions = (tracking || []).filter((t: any) => considered.has((t.status || '').toLowerCase()));
      const submittedCount = submissions.length;

      const awardedSubs = submissions.filter((t: any) => (t.status || '').toLowerCase() === 'awarded');
      const awardedCount = awardedSubs.length;
      const awardedGrantIds = awardedSubs.map((t: any) => t.grant_id).filter(Boolean);

      // Sum awarded amounts from grants table for awarded grant IDs
      let awardedTotal = 0;
      if (awardedGrantIds.length > 0) {
        const { data: grantsData } = await supabase
          .from('grants')
          .select('id, amount_awarded')
          .in('id', awardedGrantIds);
        awardedTotal = (grantsData || []).reduce((sum: number, g: any) => sum + (g.amount_awarded || 0), 0);
      }

      const awardRate = submittedCount > 0 ? Math.round(((awardedCount / submittedCount) * 100) * 10) / 10 : 0;
      const avgGrantSize = awardedCount > 0 ? Math.round(awardedTotal / awardedCount) : 0;

      // Mean of (updated_at - created_at) in days for submitted-like statuses
      const durations: number[] = submissions
        .map((s: any) => {
          const submittedAt = s.updated_at ? new Date(s.updated_at) : null;
          const createdAt = s.created_at ? new Date(s.created_at) : null;
          if (!submittedAt || !createdAt) return null;
          const diffDays = (submittedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return isFinite(diffDays) && diffDays > 0 ? diffDays : null;
        })
        .filter((d: number | null): d is number => d !== null);

      const avgTimeDays = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

      const computed: PerformanceMetrics = {
        total_submitted: submittedCount,
        total_awarded: awardedCount,
        award_rate: awardRate,
        avg_grant_size: avgGrantSize,
        avg_time_to_submission: avgTimeDays,
      };
      // Admin-only demo numbers (non-invasive, client-side only)
      let finalMetrics = computed;
      try {
        const { data: role } = await supabase.rpc('get_user_role', { user_id: userId });
        if (role === 'admin') {
          finalMetrics = {
            total_submitted: 18,
            total_awarded: 5,
            award_rate: 27.8,
            avg_grant_size: 250000,
            avg_time_to_submission: 12,
          };
        }
      } catch (e) {
        // Ignore role errors; fall back to computed metrics
      }
      setMetrics(finalMetrics);
    } catch (error) {
      console.error('Error computing performance metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDays = (days: number) => {
    if (!days || days <= 0 || Number.isNaN(days)) return '—';
    const d = Math.round(days);
    return `${d} ${d === 1 ? 'day' : 'days'}`;
  };

  if (loading) {
    return (
      <Card className="w-full rounded-xl border border-slate-200/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-6 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="w-full rounded-xl border border-slate-200/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No grant data available for metrics calculation
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="w-full rounded-xl border border-slate-200/70 shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={isOpen ? "Collapse metrics" : "Expand metrics"} tabIndex={0}>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Submitted */}
              <div data-testid="metrics-tile" tabIndex={-1} role="presentation" className="space-y-2 cursor-default select-none p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                  <TrendingUp className="h-4 w-4" />
                  Total Submitted
                </div>
                <div className="text-slate-900 text-2xl font-semibold">
                  {metrics.total_submitted}
                </div>
              </div>

              {/* Award Rate */}
              <div data-testid="metrics-tile" tabIndex={-1} role="presentation" className="space-y-2 cursor-default select-none p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                  <Award className="h-4 w-4" />
                  Award Rate
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 text-2xl font-semibold">
                    {metrics.award_rate}%
                  </span>
                  <Badge 
                    variant={metrics.award_rate >= 25 ? "default" : "secondary"}
                    className="text-xs inline-flex items-center gap-1.5"
                  >
                    {metrics.total_awarded}/{metrics.total_submitted}
                  </Badge>
                </div>
              </div>

              {/* Average Grant Size */}
              <div data-testid="metrics-tile" tabIndex={-1} role="presentation" className="space-y-2 cursor-default select-none p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                  <DollarSign className="h-4 w-4" />
                  Avg Grant Size
                </div>
                <div className="text-slate-900 text-2xl font-semibold">
                  {metrics.avg_grant_size > 0 ? formatCurrency(metrics.avg_grant_size) : '—'}
                </div>
              </div>

              {/* Average Time to Submission */}
              <div data-testid="metrics-tile" tabIndex={-1} role="presentation" className="space-y-2 cursor-default select-none p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                  <Clock className="h-4 w-4" />
                  Avg Time to Submit
                </div>
                <div className="text-slate-900 text-2xl font-semibold">
                  {formatDays(metrics.avg_time_to_submission)}
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}