import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertCircle, History, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeInput, validateTextInput } from '@/lib/security';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SecurityBadge } from './SecurityBadge';

interface FileVersion {
  id: string;
  version_number: number;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  upload_date: string;
  is_current_version: boolean;
  change_notes?: string;
}

interface EnhancedFileUploadProps {
  grantId: string;
  linkedFeature: string;
  onFileUploaded: (fileUrl: string, fileId: string) => void;
  allowedTypes?: string[];
  maxSizeMB?: number;
  existingFiles?: any[];
  showVersionHistory?: boolean;
}

export function EnhancedFileUpload({
  grantId,
  linkedFeature,
  onFileUploaded,
  allowedTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'txt'],
  maxSizeMB = 100,
  existingFiles = [],
  showVersionHistory = true
}: EnhancedFileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [fileVersions, setFileVersions] = useState<Record<string, FileVersion[]>>({});
  const [showVersions, setShowVersions] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      return `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`;
    }

    // Sanitize filename
    const sanitizedName = sanitizeInput(file.name);
    if (sanitizedName !== file.name) {
      return 'Filename contains invalid characters';
    }

    return null;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: 'File Validation Error',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const checkForExistingFile = (fileName: string) => {
    return existingFiles.find(f => f.original_name === fileName || f.file_name === fileName);
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    const notesValidation = validateTextInput(changeNotes, 0, 500);
    if (!notesValidation.isValid) {
      toast({
        title: 'Invalid Notes',
        description: notesValidation.error,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const existingFile = checkForExistingFile(selectedFile.name);
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${grantId}/${linkedFeature}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contextual-documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('contextual-documents')
        .getPublicUrl(filePath);

      let documentId: string;

      if (existingFile && showVersionHistory) {
        // Create new version
        const { data: versionData, error: versionError } = await supabase
          .rpc('create_document_version', {
            p_parent_document_id: existingFile.id,
            p_file_name: selectedFile.name,
            p_file_path: filePath,
            p_file_size: selectedFile.size,
            p_mime_type: selectedFile.type,
            p_grant_id: grantId,
            p_change_notes: sanitizeInput(changeNotes) || null
          });

        if (versionError) throw versionError;
        documentId = versionData;

        // Update existing document record
        const { error: updateError } = await supabase
          .from('contextual_documents')
          .update({
            file_path: filePath,
            file_size: selectedFile.size,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingFile.id);

        if (updateError) throw updateError;
        documentId = existingFile.id;
      } else {
        // Create new document record
        const { data: docData, error: docError } = await supabase
          .from('contextual_documents')
          .insert({
            file_name: fileName,
            original_name: selectedFile.name,
            file_path: filePath,
            file_size: selectedFile.size,
            mime_type: selectedFile.type,
            grant_id: grantId,
            linked_feature: linkedFeature,
            uploaded_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single();

        if (docError) throw docError;
        documentId = docData.id;
      }

      // Log the file action (handled by trigger)
      await supabase.rpc('log_file_action', {
        p_grant_id: grantId,
        p_file_id: documentId,
        p_file_name: selectedFile.name,
        p_action: existingFile ? 'version_upload' : 'upload',
        p_file_path: filePath,
        p_file_size: selectedFile.size,
        p_mime_type: selectedFile.type,
        p_linked_feature: linkedFeature
      });

      onFileUploaded(urlData.publicUrl, documentId);
      setSelectedFile(null);
      setChangeNotes('');

      toast({
        title: 'Upload Successful',
        description: existingFile 
          ? `New version of "${selectedFile.name}" uploaded successfully`
          : `"${selectedFile.name}" uploaded successfully`,
      });

      // Refresh version history if applicable
      if (existingFile && showVersionHistory) {
        loadFileVersions(existingFile.id);
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const loadFileVersions = async (parentDocumentId: string) => {
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('parent_document_id', parentDocumentId)
        .order('version_number', { ascending: false });

      if (error) throw error;

      setFileVersions(prev => ({
        ...prev,
        [parentDocumentId]: data || []
      }));
    } catch (error) {
      console.error('Error loading file versions:', error);
    }
  };

  const handleDownloadVersion = async (version: FileVersion) => {
    try {
      const { data, error } = await supabase.storage
        .from('contextual-documents')
        .download(version.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = version.file_name;
      link.click();
      URL.revokeObjectURL(url);

      // Log download action
      await supabase.rpc('log_file_action', {
        p_grant_id: grantId,
        p_file_id: version.id,
        p_file_name: version.file_name,
        p_action: 'download',
        p_file_path: version.file_path,
        p_linked_feature: linkedFeature
      });

    } catch (error: any) {
      toast({
        title: 'Download Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Document
            </span>
            <SecurityBadge variant="encrypted" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Select File</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    id="file-upload"
                    type="file"
                    onChange={handleFileSelect}
                    accept={allowedTypes.map(type => `.${type}`).join(',')}
                    className="cursor-pointer"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Uploads are encrypted and access-controlled.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-xs text-muted-foreground mt-1">
              Max {maxSizeMB}MB. Allowed: {allowedTypes.join(', ')}
            </p>
          </div>

          {selectedFile && (
            <>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <Badge variant="outline">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </Badge>
              </div>

              {checkForExistingFile(selectedFile.name) && showVersionHistory && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <AlertCircle className="h-4 w-4" />
                    A file with this name already exists. Uploading will create a new version.
                  </div>
                  <div>
                    <Label htmlFor="change-notes">Version Notes (optional)</Label>
                    <Input
                      id="change-notes"
                      value={changeNotes}
                      onChange={(e) => setChangeNotes(e.target.value)}
                      placeholder="Describe what changed in this version..."
                      maxLength={500}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={uploadFile} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload File'}
                </Button>
                <Button variant="outline" onClick={() => setSelectedFile(null)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Version History for existing files */}
      {showVersionHistory && existingFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Document Versions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {existingFiles.map((file) => (
                <Collapsible
                  key={file.id}
                  open={showVersions[file.id]}
                  onOpenChange={(open) => {
                    setShowVersions(prev => ({ ...prev, [file.id]: open }));
                    if (open && !fileVersions[file.id]) {
                      loadFileVersions(file.id);
                    }
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {file.original_name}
                      </span>
                      <History className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pl-6">
                    {fileVersions[file.id]?.map((version) => (
                      <div key={version.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant={version.is_current_version ? "default" : "secondary"}>
                            v{version.version_number}
                          </Badge>
                          <span className="text-sm">{version.file_name}</span>
                          {version.change_notes && (
                            <span className="text-xs text-muted-foreground">
                              ({version.change_notes})
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadVersion(version)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}