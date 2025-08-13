import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Download, Eye, Tag, Signature, Check, X, Clock, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  storage_provider: string;
  file_tags: string[];
  requires_signature: boolean;
  signature_status: string;
  uploaded_by: string;
  created_at: string;
}

interface DocumentsTabProps {
  grantId: string;
}

const DocumentsTab = ({ grantId }: DocumentsTabProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [storageProvider, setStorageProvider] = useState("local");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { userRole } = useAuth();

  const isAdmin = userRole === 'admin' || userRole === 'manager';

  const documentTags = ["Budget", "Application", "Reports", "Compliance", "Legal", "Financial"];
  const storageProviders = [
    { value: "local", label: "Local Upload", icon: FileText },
    { value: "google_drive", label: "Google Drive", icon: FileText },
    { value: "dropbox", label: "Dropbox", icon: FileText },
    { value: "onedrive", label: "OneDrive", icon: FileText },
  ];


  useEffect(() => {
    fetchDocuments();
  }, [grantId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('document_storage')
        .select('*')
        .eq('grant_id', grantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        toast({
          title: "Error",
          description: "Failed to fetch documents",
          variant: "destructive"
        });
      } else {
        setDocuments(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('image')) return '🖼️';
    return '📁';
  };

  const getSignatureStatusBadge = (status: string) => {
    switch (status) {
      case "signed":
        return <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Signed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return null;
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload PDF, DOC, DOCX, XLS, XLSX, or image files only.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload files smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploadProgress(0);
    
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${grantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('grant-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the file path for metadata
      const filePath = uploadData.path;

      // Save metadata to database
      const { data: docData, error: dbError } = await supabase
        .from('document_storage')
        .insert([{
          grant_id: grantId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: filePath,
          storage_provider: storageProvider,
          file_tags: selectedTags,
          requires_signature: requiresSignature,
          signature_status: requiresSignature ? "pending" : "not_required"
        }])
        .select()
        .single();

      if (dbError) {
        // If database insert fails, clean up the uploaded file
        await supabase.storage
          .from('grant-documents')
          .remove([filePath]);
        throw dbError;
      }

      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setUploadProgress(0);
        setSelectedTags([]);
        setRequiresSignature(false);
      }, 1000);

      toast({
        title: "Upload Complete",
        description: `${file.name} has been uploaded successfully and added to the document library.`,
      });

      // Refresh documents list
      fetchDocuments();

    } catch (error) {
      setUploadProgress(0);
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const deleteDocument = async (documentId: string, fileName: string) => {
    try {
      // Get document details first
      const { data: docData } = await supabase
        .from('document_storage')
        .select('storage_path')
        .eq('id', documentId)
        .single();

      if (docData) {
        // Delete from storage
        await supabase.storage
          .from('grant-documents')
          .remove([docData.storage_path]);
      }

      // Delete from database
      const { error } = await supabase
        .from('document_storage')
        .delete()
        .eq('id', documentId);

      if (error) {
        throw error;
      }

      toast({
        title: "Document Deleted",
        description: `${fileName} has been deleted successfully.`,
      });

      // Refresh documents list
      fetchDocuments();

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCloudConnect = (provider: string) => {
    toast({
      title: "Connecting...",
      description: `Redirecting to ${provider} for authentication...`,
    });
    
    // Mock OAuth flow
    setTimeout(() => {
      toast({
        title: "Connected!",
        description: `${provider} has been connected successfully.`,
      });
    }, 2000);
  };

  const sendForSignature = (documentId: string) => {
    setDocuments(prev => 
      prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, signature_status: "pending" }
          : doc
      )
    );

    toast({
      title: "Sent for Signature",
      description: "Document has been sent via DocuSign for signature.",
    });
  };

  const previewDocument = (document: Document) => {
    toast({
      title: "Opening Preview",
      description: `Opening ${document.file_name} in preview mode...`,
    });
  };

  const downloadDocument = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('grant-documents')
        .download(document.storage_path);

      if (error) {
        throw error;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: `${document.file_name} has been downloaded.`,
      });

    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="upload">Upload & Connect</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{documents.length} Documents</h3>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export List
            </Button>
          </div>

          <div className="grid gap-4">
            {documents.map((document) => (
              <Card key={document.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="text-2xl">
                        {getFileIcon(document.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{document.file_name}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>{formatFileSize(document.file_size)}</span>
                          <span>•</span>
                          <span>Uploaded by {document.uploaded_by}</span>
                          <span>•</span>
                          <span>{new Date(document.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {document.file_tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          <Badge variant="outline" className="text-xs">
                            {document.storage_provider}
                          </Badge>
                          {document.requires_signature && getSignatureStatusBadge(document.signature_status)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => previewDocument(document)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => downloadDocument(document)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {document.requires_signature && document.signature_status === "not_required" && (
                        <Button variant="ghost" size="sm" onClick={() => sendForSignature(document.id)}>
                          <Signature className="h-4 w-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Document</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{document.file_name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteDocument(document.id, document.file_name)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {documents.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
                  <p className="text-muted-foreground">
                    Upload your first document or connect cloud storage to get started.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storage-provider">Storage Provider</Label>
                  <Select value={storageProvider} onValueChange={setStorageProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {storageProviders.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Document Tags</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {documentTags.map((tag) => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox
                          id={tag}
                          checked={selectedTags.includes(tag)}
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              setSelectedTags(prev => [...prev, tag]);
                            } else {
                              setSelectedTags(prev => prev.filter(t => t !== tag));
                            }
                          }}
                        />
                        <Label htmlFor={tag} className="text-sm">{tag}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="signature"
                    checked={requiresSignature}
                    onCheckedChange={(checked) => setRequiresSignature(checked === true)}
                  />
                  <Label htmlFor="signature" className="text-sm">Requires Digital Signature</Label>
                </div>

                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragOver 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-muted-foreground/25'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragOver ? 'text-blue-600' : 'text-muted-foreground'}`} />
                    <p className={`text-sm ${isDragOver ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}>
                      {isDragOver ? 'Drop files here!' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, DOC, DOCX, XLS, XLSX or images up to 10MB
                    </p>
                  </Label>
                </div>

                {uploadProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cloud Storage Connections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Google Drive</p>
                        <p className="text-xs text-muted-foreground">Connect your Google Drive</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleCloudConnect("Google Drive")}>
                      Connect
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Dropbox</p>
                        <p className="text-xs text-muted-foreground">Connect your Dropbox</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleCloudConnect("Dropbox")}>
                      Connect
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">OneDrive</p>
                        <p className="text-xs text-muted-foreground">Connect your OneDrive</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleCloudConnect("OneDrive")}>
                      Connect
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Digital Signatures:</strong> Documents marked for signature will be automatically sent via DocuSign or Adobe Sign for electronic signatures.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DocumentsTab;