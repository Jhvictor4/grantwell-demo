import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, MapPin, CheckCircle, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { ensureFolders, uploadAndMapFile, TemplateType } from "@/services/fileMapping";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BulkUploadPanelProps {
  grantId: string;
  onClose: () => void;
}

interface UploadedFile {
  file: File;
  id: string;
  templateType?: string;
  periodStart?: string;
  periodEnd?: string;
  storagePath?: string;
}

const TEMPLATE_TYPES = [
  'SF-425',
  'Drawdown Log',
  'Match Certification',
  'Monitoring Checklist',
  'Narrative Report',
  'Other'
];

export function BulkUploadPanel({ grantId, onClose }: BulkUploadPanelProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [mappingStep, setMappingStep] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState<string>(grantId !== 'system' ? grantId : '');
  const [grants, setGrants] = useState<{ id: string; title: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      if (grantId !== 'system') return;
      const { data, error } = await supabase
        .from('grants')
        .select('id, title')
        .order('title');
      if (!error) setGrants(data || []);
    };
    load();
  }, [grantId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9)
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024 // 50MB
  });

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleUpdateMapping = (fileId: string, field: string, value: string) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, [field]: value } : f
    ));
  };

  const handleProceedToMapping = () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No files",
        description: "Please upload files before proceeding to mapping",
        variant: "destructive",
      });
      return;
    }
    setMappingStep(true);
  };

  const handleProcessFiles = async () => {
    try {
      setProcessing(true);

      const targetGrantId = grantId === 'system' ? selectedGrantId : grantId;
      if (!targetGrantId) {
        toast({ title: 'Select a grant', description: 'Choose a grant before processing files.', variant: 'destructive' });
        return;
      }

      // Ensure folder structure exists
      await ensureFolders(targetGrantId);

      for (const uploadedFile of uploadedFiles) {
        if (!uploadedFile.templateType) {
          toast({
            title: 'Missing template type',
            description: `Please select a template type for ${uploadedFile.file.name}`,
            variant: 'destructive',
          });
          return;
        }

        await uploadAndMapFile({
          grant_id: targetGrantId,
          file: uploadedFile.file,
          template_type: uploadedFile.templateType as TemplateType,
          period_start: uploadedFile.periodStart || null,
          period_end: uploadedFile.periodEnd || null,
        });
      }

      toast({
        title: 'Success',
        description: `${uploadedFiles.length} files uploaded and mapped successfully`,
      });

      onClose();
    } catch (error) {
      console.error('Error processing files:', error);
      toast({
        title: 'Error',
        description: 'Failed to process uploaded files',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Document Upload & Mapping
          </DialogTitle>
        </DialogHeader>

        {!mappingStep ? (
          <div className="space-y-6">
            {/* Upload Area */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  {isDragActive ? (
                    <p>Drop the files here...</p>
                  ) : (
                    <div>
                      <p className="text-lg font-medium mb-2">Drag & drop files here</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        or click to select files
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports: PDF, Excel, Word, CSV (up to 50MB each)
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Uploaded Files ({uploadedFiles.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {uploadedFiles.map((uploadedFile) => (
                      <div key={uploadedFile.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">{uploadedFile.file.name}</span>
                          <Badge variant="outline">
                            {(uploadedFile.file.size / 1024 / 1024).toFixed(1)} MB
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveFile(uploadedFile.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleProceedToMapping} disabled={uploadedFiles.length === 0}>
                <MapPin className="h-4 w-4 mr-2" />
                Proceed to Mapping
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* File Mapping */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Map Files to DOJ Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {uploadedFiles.map((uploadedFile) => (
                    <div key={uploadedFile.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">{uploadedFile.file.name}</span>
                      </div>
                      
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <Label>Template Type *</Label>
                          <Select
                            value={uploadedFile.templateType}
                            onValueChange={(value) => handleUpdateMapping(uploadedFile.id, 'templateType', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select template" />
                            </SelectTrigger>
                            <SelectContent>
                              {TEMPLATE_TYPES.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>Period Start</Label>
                          <Input
                            type="date"
                            value={uploadedFile.periodStart || ''}
                            onChange={(e) => handleUpdateMapping(uploadedFile.id, 'periodStart', e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <Label>Period End</Label>
                          <Input
                            type="date"
                            value={uploadedFile.periodEnd || ''}
                            onChange={(e) => handleUpdateMapping(uploadedFile.id, 'periodEnd', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setMappingStep(false)}>
                Back to Upload
              </Button>
              <Button onClick={handleProcessFiles} disabled={processing}>
                {processing ? (
                  "Processing..."
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Process Files
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}