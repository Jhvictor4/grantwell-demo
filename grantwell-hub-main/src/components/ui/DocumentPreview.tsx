import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Download, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentPreviewProps {
  fileUrl: string;
  fileName: string;
  children?: React.ReactNode;
}

export function DocumentPreview({ fileUrl, fileName, children }: DocumentPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const isPreviewable = (filename: string) => {
    const ext = getFileExtension(filename);
    return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  };

  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  const handlePreviewError = () => {
    setLoading(false);
    toast({
      title: "Preview Error",
      description: "Unable to preview this file. You can download it instead.",
      variant: "destructive"
    });
  };

  const renderPreview = () => {
    const ext = getFileExtension(fileName);
    
    if (ext === 'pdf') {
      return (
        <iframe
          src={fileUrl}
          className="w-full h-[70vh] border rounded"
          title={fileName}
          onLoad={() => setLoading(false)}
          onError={handlePreviewError}
        />
      );
    }
    
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
      return (
        <div className="flex justify-center">
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-[70vh] object-contain rounded"
            onLoad={() => setLoading(false)}
            onError={handlePreviewError}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-[40vh] text-center space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">Preview Not Available</h3>
          <p className="text-muted-foreground mt-1">
            This file type cannot be previewed in the browser.
          </p>
          <Button 
            className="mt-4" 
            onClick={handleDownload}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Download File
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1" />
            View File
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{fileName}</span>
            <div className="flex items-center space-x-2 ml-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {loading && isPreviewable(fileName) && (
            <div className="flex items-center justify-center h-[40vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}