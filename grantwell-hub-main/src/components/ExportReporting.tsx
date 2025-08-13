import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Download, FileText, BarChart3, DollarSign, Calendar, Users, Target } from 'lucide-react';

interface ExportOptions {
  format: 'pdf' | 'csv' | 'excel';
  includeFinancials: boolean;
  includeTimeline: boolean;
  includeTeam: boolean;
  includeTasks: boolean;
  includeDocuments: boolean;
  dateRange: 'all' | 'last30' | 'last90' | 'lastyear';
  grantIds: string[];
}

interface ExportReportingProps {
  grantId?: string;
  title?: string;
}

const ExportReporting: React.FC<ExportReportingProps> = ({ grantId, title = "Export Report" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    includeFinancials: true,
    includeTimeline: true,
    includeTeam: false,
    includeTasks: false,
    includeDocuments: false,
    dateRange: 'all',
    grantIds: grantId ? [grantId] : []
  });
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Mock data fetching and export generation
      toast({
        title: "Generating Report",
        description: `Creating ${exportOptions.format.toUpperCase()} report...`,
      });

      // Simulate export process
      setTimeout(() => {
        // Mock download
        const fileName = `Grantwell_Report_${format(new Date(), 'yyyy-MM-dd')}.${exportOptions.format}`;
        
        toast({
          title: "Export Complete",
          description: `${fileName} has been downloaded successfully.`,
        });

        setIsExporting(false);
        setIsOpen(false);
      }, 3000);

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate report. Please try again.",
        variant: "destructive"
      });
      setIsExporting(false);
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return '📄';
      case 'csv': return '📊';
      case 'excel': return '📈';
      default: return '📄';
    }
  };

  const getEstimatedSize = () => {
    let baseSize = 50; // KB
    
    if (exportOptions.includeFinancials) baseSize += 25;
    if (exportOptions.includeTimeline) baseSize += 30;
    if (exportOptions.includeTeam) baseSize += 15;
    if (exportOptions.includeTasks) baseSize += 40;
    if (exportOptions.includeDocuments) baseSize += 100;
    
    if (exportOptions.format === 'pdf') baseSize *= 1.5;
    if (exportOptions.format === 'excel') baseSize *= 1.2;
    
    return baseSize > 1000 ? `${(baseSize / 1000).toFixed(1)}MB` : `${Math.round(baseSize)}KB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Grant Report</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Export Format */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['pdf', 'csv', 'excel'] as const).map((format) => (
                <Card 
                  key={format}
                  className={`cursor-pointer border-2 ${
                    exportOptions.format === format ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                  }`}
                  onClick={() => setExportOptions(prev => ({ ...prev, format }))}
                >
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">{getFormatIcon(format)}</div>
                    <div className="text-xs font-medium uppercase">{format}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <Select 
              value={exportOptions.dateRange} 
              onValueChange={(value: any) => setExportOptions(prev => ({ ...prev, dateRange: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="last30">Last 30 Days</SelectItem>
                <SelectItem value="last90">Last 90 Days</SelectItem>
                <SelectItem value="lastyear">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Include in Report</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="financials"
                  checked={exportOptions.includeFinancials}
                  onCheckedChange={(checked) => 
                    setExportOptions(prev => ({ ...prev, includeFinancials: checked as boolean }))
                  }
                />
                <Label htmlFor="financials" className="text-sm flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Financial Summary & Budget
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="timeline"
                  checked={exportOptions.includeTimeline}
                  onCheckedChange={(checked) => 
                    setExportOptions(prev => ({ ...prev, includeTimeline: checked as boolean }))
                  }
                />
                <Label htmlFor="timeline" className="text-sm flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Timeline & Milestones
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="team"
                  checked={exportOptions.includeTeam}
                  onCheckedChange={(checked) => 
                    setExportOptions(prev => ({ ...prev, includeTeam: checked as boolean }))
                  }
                />
                <Label htmlFor="team" className="text-sm flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  Team Members & Assignments
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tasks"
                  checked={exportOptions.includeTasks}
                  onCheckedChange={(checked) => 
                    setExportOptions(prev => ({ ...prev, includeTasks: checked as boolean }))
                  }
                />
                <Label htmlFor="tasks" className="text-sm flex items-center">
                  <Target className="h-4 w-4 mr-1" />
                  Tasks & Progress
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="documents"
                  checked={exportOptions.includeDocuments}
                  onCheckedChange={(checked) => 
                    setExportOptions(prev => ({ ...prev, includeDocuments: checked as boolean }))
                  }
                />
                <Label htmlFor="documents" className="text-sm flex items-center">
                  <FileText className="h-4 w-4 mr-1" />
                  Document List & Links
                </Label>
              </div>
            </div>
          </div>

          {/* Export Summary */}
          <Card className="bg-slate-50">
            <CardContent className="p-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Estimated file size:</span>
                <Badge variant="outline">{getEstimatedSize()}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-slate-600">Content sections:</span>
                <Badge variant="outline">
                  {[
                    exportOptions.includeFinancials && 'Financials',
                    exportOptions.includeTimeline && 'Timeline', 
                    exportOptions.includeTeam && 'Team',
                    exportOptions.includeTasks && 'Tasks',
                    exportOptions.includeDocuments && 'Documents'
                  ].filter(Boolean).length} sections
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={isExporting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isExporting ? (
                <>
                  <BarChart3 className="h-4 w-4 mr-2 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportReporting;