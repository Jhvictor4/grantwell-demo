import React, { useState, useCallback } from 'react';
import { Upload, X, Download, Eye, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UploadedFile {
  id: string;
  file_name: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  upload_date: string;
  file_path: string;
  description?: string;
  tags?: string[];
}

interface ContextualFileUploadProps {
  context_type: string; // 'narrative' | 'report' | 'task' | etc.
  context_id: string; // ID of the specific entity (narrative ID, report ID, task ID, etc.)
  grantId?: string;
  existingFiles?: UploadedFile[];
  onFilesChange?: (files: UploadedFile[]) => void;
  multiple?: boolean;
  acceptedTypes?: string;
  maxSizeMB?: number;
  title?: string;
  description?: string;
}

export function ContextualFileUpload({
  context_type,
  context_id,
  grantId,
  existingFiles = [],
  onFilesChange,
  multiple = true,
  acceptedTypes = ".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls",
  maxSizeMB = 10,
  title = "Upload Files",
  description = "Attach supporting documents"
}: ContextualFileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = useCallback(async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;

    const filesToUpload = Array.from(fileList);
    
    // Validate file sizes
    const oversizedFiles = filesToUpload.filter(file => file.size > maxSizeMB * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${maxSizeMB}MB`,
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to upload files",
          variant: "destructive"
        });
        return;
      }

      const uploadedFiles: UploadedFile[] = [];

      for (const file of filesToUpload) {
        const fileExt = file.name.split('.').pop();
        const randomName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Decide storage bucket and path
        let bucket = 'contextual-documents';
        let filePath = '';
        let uploadError: any = null;

        if (grantId) {
          bucket = 'grant-documents';
          filePath = `grant-documents/${grantId}/${randomName}`;
          const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file);
          uploadError = error;
        } else {
          const contextualPath = `${user.id}/${randomName}`;
          const { error } = await supabase.storage
            .from(bucket)
            .upload(contextualPath, file);
          uploadError = error;
          filePath = contextualPath;
        }

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}`,
            variant: "destructive"
          });
          continue;
        }

        // Save metadata to database
        const { data: documentData, error: dbError } = await supabase
          .from('contextual_documents')
          .insert({
            file_name: randomName,
            original_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            file_path: filePath,
            linked_feature: grantId ? 'attachments' : context_type,
            linked_entity_id: context_id,
            grant_id: grantId,
            uploaded_by: user.id
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database error:', dbError);
          // Clean up uploaded file
          await supabase.storage
            .from(bucket)
            .remove([filePath]);
          
          toast({
            title: "Database error",
            description: `Failed to save ${file.name} metadata`,
            variant: "destructive"
          });
          continue;
        }

        uploadedFiles.push(documentData);
      }

      const newFiles = [...files, ...uploadedFiles];
      setFiles(newFiles);
      onFilesChange?.(newFiles);

      toast({
        title: "Upload successful",
        description: `${uploadedFiles.length} file(s) uploaded successfully`
      });

    } catch (error) {
      console.error('Upload process error:', error);
      toast({
        title: "Upload failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  }, [files, context_type, context_id, grantId, maxSizeMB, onFilesChange, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleFileDelete = async (fileId: string) => {
    try {
      const fileToDelete = files.find(f => f.id === fileId);
      if (!fileToDelete) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('contextual-documents')
        .remove([fileToDelete.file_name]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('contextual_documents')
        .delete()
        .eq('id', fileId);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        toast({
          title: "Delete failed",
          description: "Failed to delete file",
          variant: "destructive"
        });
        return;
      }

      const newFiles = files.filter(f => f.id !== fileId);
      setFiles(newFiles);
      onFilesChange?.(newFiles);

      toast({
        title: "File deleted",
        description: "File removed successfully"
      });

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const handleFileDownload = async (file: UploadedFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('contextual-documents')
        .download(file.file_name);

      if (error) {
        console.error('Download error:', error);
        toast({
          title: "Download failed",
          description: "Failed to download file",
          variant: "destructive"
        });
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Download process error:', error);
      toast({
        title: "Download failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileText className="h-4 w-4 text-green-500" />;
    if (mimeType.includes('image')) return <Eye className="h-4 w-4 text-purple-500" />;
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-medium">{title}</Label>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>

      {/* Upload Area */}
      <Card className={`border-dashed transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}`}>
        <CardContent 
          className="p-6"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Drag and drop files here, or{' '}
                <Label htmlFor="file-upload" className="text-primary cursor-pointer hover:underline">
                  browse
                </Label>
              </p>
              <p className="text-xs text-muted-foreground">Max {maxSizeMB}MB</p>
            </div>
            <Input
              id="file-upload"
              type="file"
              className="hidden"
              accept={acceptedTypes}
              multiple={multiple}
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              disabled={uploading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Uploaded Files ({files.length})</Label>
          <div className="space-y-2">
            {files.map((file) => (
              <Card key={file.id} className="border border-muted">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getFileIcon(file.mime_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.original_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.file_size)} • {new Date(file.upload_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleFileDownload(file)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleFileDelete(file.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {uploading && (
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Uploading...</p>
        </div>
      )}
    </div>
  );
}