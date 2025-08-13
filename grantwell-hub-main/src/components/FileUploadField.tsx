import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Upload, File, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadFieldProps {
  onFileUploaded: (fileUrl: string) => void;
  allowedTypes?: string[];
  maxSize?: number; // in MB
}

const FileUploadField: React.FC<FileUploadFieldProps> = ({
  onFileUploaded,
  allowedTypes = ['.pdf', '.docx', '.doc', '.xlsx', '.xls'],
  maxSize = 10
}) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `File size must be less than ${maxSize}MB`,
        variant: "destructive"
      });
      return;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        title: "Invalid File Type",
        description: `Only ${allowedTypes.join(', ')} files are allowed`,
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `compliance-${Date.now()}.${fileExt}`;
      const filePath = `compliance-docs/${fileName}`;

      const { data, error } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, selectedFile);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('grant-documents')
        .getPublicUrl(filePath);

      onFileUploaded(publicUrl);
      setSelectedFile(null);
      
      toast({
        title: "Upload Successful",
        description: "Document has been uploaded successfully."
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="file-upload">Attach Document (Optional)</Label>
      
      {!selectedFile ? (
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
          <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <Label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-sm text-slate-600">
              Click to upload or drag and drop
            </span>
            <br />
            <span className="text-xs text-slate-400">
              {allowedTypes.join(', ')} up to {maxSize}MB
            </span>
          </Label>
          <Input
            id="file-upload"
            type="file"
            accept={allowedTypes.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            <File className="h-4 w-4 text-slate-600" />
            <span className="text-sm text-slate-900">{selectedFile.name}</span>
            <span className="text-xs text-slate-500">
              ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={uploadFile}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={removeFile}
              disabled={uploading}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadField;