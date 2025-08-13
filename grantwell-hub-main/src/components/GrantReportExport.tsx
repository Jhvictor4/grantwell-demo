import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GrantReportExportProps {
  grantId: string;
  grantTitle: string;
}

export const GrantReportExport: React.FC<GrantReportExportProps> = ({ grantId, grantTitle }) => {
  const { toast } = useToast();

  const exportToPDF = () => {
    // Generate basic PDF content
    const pdfContent = `Grant Report: ${grantTitle}\nGrant ID: ${grantId}\nGenerated on: ${new Date().toLocaleDateString()}`;
    
    // Create a simple PDF blob
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grant-report-${grantId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "PDF Export", description: "Basic PDF report has been generated and downloaded." });
  };

  const exportToCSV = () => {
    // Generate CSV content
    const csvContent = `Grant Title,Grant ID,Export Date\n"${grantTitle}","${grantId}","${new Date().toLocaleDateString()}"`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grant-data-${grantId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "CSV Export", description: "Grant data has been exported to CSV successfully." });
  };

  return (
    <div className="flex gap-2">
      <Button onClick={exportToPDF} variant="outline">
        <FileText className="h-4 w-4 mr-2" />
        Export PDF
      </Button>
      <Button onClick={exportToCSV} variant="outline">
        <Download className="h-4 w-4 mr-2" />
        Export CSV
      </Button>
    </div>
  );
};