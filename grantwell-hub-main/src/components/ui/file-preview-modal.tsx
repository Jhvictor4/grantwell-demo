import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Eye, X } from 'lucide-react';

interface FilePreviewModalProps {
  fileName: string;
  fileUrl: string;
  fileType: string;
  status?: string;
  onStatusChange?: (newStatus: string) => void;
  onDownload?: () => void;
  children: React.ReactNode;
}

export function FilePreviewModal({
  fileName,
  fileUrl,
  fileType,
  status = 'logged',
  onStatusChange,
  onDownload,
  children
}: FilePreviewModalProps) {
  const isImage = fileType.startsWith('image/');
  const isPDF = fileType === 'application/pdf';
  const canPreview = isImage || isPDF;

  const statusOptions = [
    { value: 'logged', label: 'Logged', color: 'default' },
    { value: 'reviewed', label: 'Reviewed', color: 'secondary' },
    { value: 'approved', label: 'Approved', color: 'default' },
    { value: 'rejected', label: 'Rejected', color: 'destructive' }
  ];

  const currentStatus = statusOptions.find(s => s.value === status) || statusOptions[0];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{fileName}</span>
            <div className="flex items-center gap-2">
              {onStatusChange && (
                <Select value={status} onValueChange={onStatusChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <Badge variant={option.color as any} className="text-xs">
                          {option.label}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(fileUrl, '_blank');
                  onDownload?.();
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {canPreview ? (
            <div className="w-full h-[60vh] border rounded-lg overflow-hidden">
              {isImage ? (
                <img
                  src={fileUrl}
                  alt={fileName}
                  className="w-full h-full object-contain bg-gray-50"
                />
              ) : isPDF ? (
                <iframe
                  src={fileUrl}
                  className="w-full h-full"
                  title={fileName}
                />
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 border-2 border-dashed border-muted rounded-lg">
              <div className="text-center">
                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Preview not available for this file type</p>
                <p className="text-sm text-muted-foreground mt-2">Click Download to view the file</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            File type: {fileType} | Status: <Badge variant={currentStatus.color as any}>{currentStatus.label}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(fileUrl, '_blank')}
          >
            <Eye className="h-4 w-4 mr-2" />
            Open in New Tab
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}