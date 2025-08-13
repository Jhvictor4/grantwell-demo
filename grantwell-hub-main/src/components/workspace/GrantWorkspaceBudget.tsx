import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Upload,
  Download,
  Calculator,
  AlertTriangle,
  CheckCircle,
  PieChart
} from 'lucide-react';
import { logGrantActivityWithDescription } from '@/lib/activity-logger';
import { hasPermission, SystemRole, GrantRole } from '@/lib/permissions';

interface BudgetSummary {
  total_awarded: number;
  total_spent: number;
  remaining_funds: number;
}

interface GrantWorkspaceBudgetProps {
  grantId: string;
  userRole: SystemRole;
  grantRole?: GrantRole;
  isOwner?: boolean;
}

export function GrantWorkspaceBudget({ 
  grantId, 
  userRole, 
  grantRole, 
  isOwner = false 
}: GrantWorkspaceBudgetProps) {
  const { toast } = useToast();
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [awardAcceptance, setAwardAcceptance] = useState({
    award_letter_received: false,
    start_date: '',
    end_date: '',
    signed_document_url: ''
  });

  const canEdit = hasPermission('edit:budget', userRole, grantRole, isOwner);

  useEffect(() => {
    if (grantId) {
      loadBudgetData();
    }
  }, [grantId]);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      
      // Load budget summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('budget_summaries')
        .select('*')
        .eq('grant_id', grantId)
        .maybeSingle();

      if (summaryError && summaryError.code !== 'PGRST116') {
        console.error('Error loading budget summary:', summaryError);
        return;
      }

      if (summaryData) {
        setBudgetSummary({
          total_awarded: summaryData.total_awarded || 0,
          total_spent: summaryData.total_spent || 0,
          remaining_funds: summaryData.remaining_funds || 0
        });
      } else {
        // Initialize with grant amount if available
        const { data: grantData } = await supabase
          .from('grants')
          .select('amount_awarded')
          .eq('id', grantId)
          .single();

        setBudgetSummary({
          total_awarded: grantData?.amount_awarded || 0,
          total_spent: 0,
          remaining_funds: grantData?.amount_awarded || 0
        });
      }

      // Load category breakdown via RPC
      const { data: breakdownData, error: breakdownError } = await supabase.rpc('get_budget_summary', { p_grant_id: grantId });
      if (!breakdownError && breakdownData && breakdownData.length > 0) {
        const raw = (breakdownData[0] as any)?.category_breakdown;
        const list = Array.isArray(raw) ? (raw as any[]) : [];
        setCategoryBreakdown(list);
      }
    } catch (error) {
      console.error('Error loading budget data:', error);
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

  const getUtilizationRate = () => {
    if (!budgetSummary || budgetSummary.total_awarded === 0) return 0;
    return (budgetSummary.total_spent / budgetSummary.total_awarded) * 100;
  };

  const getUtilizationColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600';
    if (rate >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!hasPermission('view:budget', userRole, grantRole, isOwner)) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              You do not have permission to view the budget section.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const utilizationRate = getUtilizationRate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Budget & Financial Management</h2>
          <p className="text-muted-foreground">
            Track award acceptance, budget utilization, and financial compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={getUtilizationColor(utilizationRate)}>
            {utilizationRate.toFixed(1)}% Utilized
          </Badge>
          {canEdit && (
            <Button asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload Budget Document
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const fileName = `${Date.now()}_${file.name}`;
                      const filePath = `grant-documents/${grantId}/${fileName}`;
                      const { error: uploadError } = await supabase.storage
                        .from('grant-documents')
                        .upload(filePath, file);
                      if (uploadError) throw uploadError;

                      const { error: dbError } = await supabase
                        .from('contextual_documents')
                        .insert({
                          file_name: fileName,
                          original_name: file.name,
                          file_size: file.size,
                          mime_type: file.type,
                          file_path: filePath,
                          grant_id: grantId,
                          linked_feature: 'attachments',
                          upload_date: new Date().toISOString(),
                        });
                      if (dbError) throw dbError;

                      await logGrantActivityWithDescription(
                        grantId,
                        'file_uploaded',
                        `uploaded budget document "${file.name}"`,
                        { file_name: file.name }
                      );

                      toast({ title: 'Uploaded', description: 'Budget document saved to Attachments.' });
                    } catch (err: any) {
                      console.error(err);
                      toast({ title: 'Error', description: err.message || 'Upload failed', variant: 'destructive' });
                    } finally {
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </label>
            </Button>
          )}
          <Button variant="outline" onClick={() => {
            const bs = budgetSummary || { total_awarded: 0, total_spent: 0, remaining_funds: 0 };
            const csv = 'Metric,Amount\n' +
              `Total Awarded,${bs.total_awarded}\n` +
              `Total Spent,${bs.total_spent}\n` +
              `Remaining,${bs.remaining_funds}\n`;
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'budget-summary.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}>
            <Download className="h-4 w-4 mr-2" />
            Export Budget Report
          </Button>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Awarded</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(budgetSummary?.total_awarded || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(budgetSummary?.total_spent || 0)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
            <Progress 
              value={utilizationRate} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(budgetSummary?.remaining_funds || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Category Breakdown */}
      {categoryBreakdown && categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Budget Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryBreakdown.map((item: any, idx: number) => (
                <div key={idx} className="rounded border p-3 bg-card">
                  <div className="text-sm font-medium">{item.category}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Budgeted: {formatCurrency(item.budgeted || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Spent: {formatCurrency(item.spent || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Remaining: {formatCurrency(item.remaining || 0)}
                  </div>
                  <Progress 
                    value={item.budgeted > 0 ? (item.spent / item.budgeted) * 100 : 0} 
                    className="mt-2 h-1"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Award Acceptance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Award Acceptance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="award-letter"
                  checked={awardAcceptance.award_letter_received}
                  onChange={(e) => setAwardAcceptance(prev => ({
                    ...prev,
                    award_letter_received: e.target.checked
                  }))}
                  disabled={!canEdit}
                  className="rounded"
                />
                <Label htmlFor="award-letter" className="text-sm">
                  Award Letter Received
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-sm font-medium">
                Start Date
              </Label>
              <Input
                type="date"
                id="start-date"
                value={awardAcceptance.start_date}
                onChange={(e) => setAwardAcceptance(prev => ({
                  ...prev,
                  start_date: e.target.value
                }))}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-sm font-medium">
                End Date
              </Label>
              <Input
                type="date"
                id="end-date"
                value={awardAcceptance.end_date}
                onChange={(e) => setAwardAcceptance(prev => ({
                  ...prev,
                  end_date: e.target.value
                }))}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signed-doc" className="text-sm font-medium">
                Signed Award Document
              </Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  id="signed-doc"
                  accept=".pdf,.doc,.docx"
                  disabled={!canEdit}
                  className="flex-1"
                />
                {awardAcceptance.signed_document_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(awardAcceptance.signed_document_url, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Budget Tracking & Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">
                  Total Awarded
                </Label>
                <Input
                  type="number"
                  id="amount"
                  value={budgetSummary?.total_awarded || 0}
                  disabled={!canEdit}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="drawn" className="text-sm font-medium">
                  Amount Drawn
                </Label>
                <Input
                  type="number"
                  id="drawn"
                  value={budgetSummary?.total_spent || 0}
                  disabled={!canEdit}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remaining" className="text-sm font-medium">
                  Remaining
                </Label>
                <Input
                  type="number"
                  id="remaining"
                  value={budgetSummary?.remaining_funds || 0}
                  disabled
                  className="font-mono bg-muted"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
              {/* Upload Budget Approval */}
              <div>
                <input
                  id="budget-approval-upload"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const fileName = `${Date.now()}_${file.name}`;
                      const filePath = `grant-documents/${grantId}/${fileName}`;
                      const { error: uploadError } = await supabase.storage
                        .from('grant-documents')
                        .upload(filePath, file);
                      if (uploadError) throw uploadError;

                      const { error: dbError } = await supabase
                        .from('contextual_documents')
                        .insert({
                          file_name: fileName,
                          original_name: file.name,
                          file_size: file.size,
                          mime_type: file.type,
                          file_path: filePath,
                          grant_id: grantId,
                          linked_feature: 'attachments',
                          upload_date: new Date().toISOString(),
                        });
                      if (dbError) throw dbError;

                      await logGrantActivityWithDescription(
                        grantId,
                        'file_uploaded',
                        `uploaded budget approval "${file.name}"`,
                        { file_name: file.name, section: 'budget' }
                      );

                      toast({ title: 'Uploaded', description: 'Budget approval saved to Attachments.' });
                    } catch (err: any) {
                      console.error(err);
                      toast({ title: 'Error', description: err.message || 'Upload failed', variant: 'destructive' });
                    } finally {
                      e.currentTarget.value = '';
                    }
                  }}
                  disabled={!canEdit}
                />
                <Button
                  variant="outline"
                  disabled={!canEdit}
                  onClick={() => document.getElementById('budget-approval-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Budget Approval
                </Button>
              </div>

              {/* Add Transaction */}
              <Button
                variant="outline"
                disabled={!canEdit}
                onClick={() => {
                  window.location.href = `/budget-finance?grantId=${grantId}`;
                }}
              >
                <PieChart className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>

              {/* Export Budget Report */}
              <Button
                variant="outline"
                onClick={() => {
                  const bs = budgetSummary || { total_awarded: 0, total_spent: 0, remaining_funds: 0 };
                  const csv = 'Metric,Amount\n' +
                    `Total Awarded,${bs.total_awarded}\n` +
                    `Total Spent,${bs.total_spent}\n` +
                    `Remaining,${bs.remaining_funds}\n`;
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'budget-summary.csv';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Budget Report
              </Button>

              {/* Budget Calculator */}
              <Button
                variant="outline"
                onClick={() => {
                  toast({ title: 'Budget Calculator', description: 'Opening Budget Calculator (coming soon).' });
                }}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Budget Calculator
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Alerts */}
      {utilizationRate > 80 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <h4 className="font-medium text-yellow-800">Budget Alert</h4>
                <p className="text-sm text-yellow-700">
                  You have utilized {utilizationRate.toFixed(1)}% of your budget. 
                  Consider reviewing remaining expenses and timeline.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}